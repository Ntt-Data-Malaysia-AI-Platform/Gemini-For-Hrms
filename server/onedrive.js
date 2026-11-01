// OneDrive (Microsoft Graph) for the HR operations persona: browse, search and analyse documents.
// The browser obtains a delegated Graph token for the signed-in Microsoft 365 user (Files.Read.All) and
// sends it with each request; it is used for that request only and never stored or logged.
// Document analysis downloads the file (Office files converted to PDF by Graph) and asks Gemini to
// extract the HR-relevant details.

const GRAPH = 'https://graph.microsoft.com/v1.0';
const MAX_BYTES = 12 * 1024 * 1024;
const NEEDS_M365 = 'OneDrive is available after signing in with Microsoft 365. Sign out and use "Sign in with Microsoft 365".';

async function graph(token, path, { raw = false } = {}) {
  if (!token) throw new Error(NEEDS_M365);
  const res = await fetch(path.startsWith('http') ? path : GRAPH + path, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error('Your Microsoft 365 session expired. Reconnect OneDrive.');
    if (res.status === 403) throw new Error('Microsoft 365 denied access to OneDrive (the app needs the Files.Read.All permission).');
    if (res.status === 404) throw new Error('That OneDrive item was not found.');
    let msg = text.slice(0, 160);
    try { msg = JSON.parse(text).error?.message || msg; } catch { /* keep raw */ }
    throw new Error(`OneDrive request failed (${res.status}): ${msg}`);
  }
  return raw ? res : res.json();
}

const kind = (it) => {
  if (it.folder) return 'Folder';
  const ext = (it.name.split('.').pop() || '').toLowerCase();
  return { pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', csv: 'CSV', ppt: 'PowerPoint', pptx: 'PowerPoint', txt: 'Text', md: 'Text', png: 'Image', jpg: 'Image', jpeg: 'Image' }[ext] || ext.toUpperCase() || 'File';
};
const item = (it) => ({
  id: it.id,
  name: it.name,
  type: kind(it),
  isFolder: Boolean(it.folder),
  children: it.folder?.childCount ?? null,
  size: it.size ?? null,
  modified: it.lastModifiedDateTime?.slice(0, 10) ?? null,
  modifiedBy: it.lastModifiedBy?.user?.displayName ?? null,
  createdBy: it.createdBy?.user?.displayName ?? null,
  path: it.parentReference?.path?.replace(/^\/drive\/root:?/, '') || '/',
  webUrl: it.webUrl,
});
const sortItems = (list) => list.sort((a, b) => (b.isFolder - a.isFolder) || a.name.localeCompare(b.name));
const SELECT = '$select=id,name,size,folder,file,lastModifiedDateTime,lastModifiedBy,createdBy,parentReference,webUrl';

export async function listFolder(token, folderId) {
  const r = await graph(token, `/me/drive/${folderId ? `items/${encodeURIComponent(folderId)}` : 'root'}/children?$top=200&${SELECT}`);
  const here = folderId ? item(await graph(token, `/me/drive/items/${encodeURIComponent(folderId)}?${SELECT}`)) : { id: null, name: 'My files', path: '/' };
  return { folder: here, items: sortItems(r.value.map(item)) };
}

export async function search(token, query) {
  const q = String(query || '').replace(/'/g, "''").slice(0, 100);
  if (!q.trim()) return { query: q, items: [] };
  const r = await graph(token, `/me/drive/root/search(q='${encodeURIComponent(q)}')?$top=50&${SELECT}`);
  return { query, items: sortItems(r.value.map(item)) };
}

const MIME = { PDF: 'application/pdf', Text: 'text/plain', CSV: 'text/csv', Image: 'image/png' };
const OFFICE = new Set(['Word', 'Excel', 'PowerPoint']);

// Download a file Gemini can read: PDF, text and images as-is; Office documents converted to PDF by Graph.
async function readable(token, it) {
  const t = kind(it);
  if (!OFFICE.has(t) && !MIME[t]) throw new Error(`${t} files cannot be analysed yet. Supported: PDF, Word, Excel, PowerPoint, text, CSV and images.`);
  if (it.size > MAX_BYTES * 4) throw new Error('This file is too large to analyse.');
  const res = await graph(token, `/me/drive/items/${encodeURIComponent(it.id)}/content${OFFICE.has(t) ? '?format=pdf' : ''}`, { raw: true });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('This file is too large to analyse (over 12 MB).');
  const ext = it.name.split('.').pop().toLowerCase();
  const mime = OFFICE.has(t) ? 'application/pdf' : t === 'Image' ? (ext === 'png' ? 'image/png' : 'image/jpeg') : MIME[t];
  return { mime, data: buf.toString('base64') };
}

const EXTRACT = `You are an HR document analyst. Read the attached document and return Markdown in exactly this shape:
### <document type and subject in a few words>
> <two-sentence summary of what the document is and whether it is complete>
#### Key details
| Field | Value |
|---|---|
(6 to 12 rows: people, employee IDs, roles, dates, effective/expiry dates, amounts, reference numbers, signatures present)
#### Checks
- **Completeness**: ...
- **Discrepancies or risks**: ... (expired dates, missing signatures, mismatched names or amounts, missing sections)
- **Sensitive data**: list categories present (for example passport number, bank details), never the values
#### Next steps
- 2 to 3 short imperative follow-ups an HR analyst could ask for, at most 12 words each
Only state what the document shows; write "Not stated" when a field is absent. Mask identity, bank and passport numbers to the last 4 characters.`;

export async function analyse(token, fileId) {
  const it = await graph(token, `/me/drive/items/${encodeURIComponent(fileId)}?${SELECT}`);
  if (it.folder) throw new Error('That is a folder; choose a document.');
  const meta = item(it);
  const file = await readable(token, it);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ...meta, analysis: null, note: 'Set GEMINI_API_KEY to analyse document contents.' };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: EXTRACT }] },
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: file.mime, data: file.data } }, { text: `File name: ${meta.name}` }] }],
      generationConfig: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Document analysis failed (Gemini ${res.status}).`);
  const analysis = (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  return { ...meta, analysis: analysis || 'No details could be extracted from this document.' };
}

// Tools for the HR agents. The token comes from the request (user.graphToken), never from storage.
const S = (description) => ({ type: 'STRING', description });
export const onedriveTools = {
  onedrive_list_documents: {
    description: "List files and folders in the signed-in HR user's OneDrive. Pass a folderId from a previous result to open a folder; omit it for the top level.",
    parameters: { type: 'OBJECT', properties: { folderId: S('Folder ID from an earlier OneDrive result (optional)') } },
    run: (u, a) => listFolder(u.graphToken, a.folderId),
    brief: (d) => `Found **${d.items.length}** items in ${d.folder.name}.`,
  },
  onedrive_search_documents: {
    description: "Search the signed-in HR user's OneDrive for documents by name or content (for example 'offer letter', 'passport', 'Jack Turner').",
    parameters: { type: 'OBJECT', properties: { query: S('Search words') }, required: ['query'] },
    run: (u, a) => search(u.graphToken, a.query),
    brief: (d) => `Found **${d.items.length}** documents matching "${d.query}".`,
  },
  onedrive_document_details: {
    description: 'Open one OneDrive document and extract its HR-relevant details (type, people, dates, amounts, completeness, discrepancies). Use the id from a list or search result.',
    parameters: { type: 'OBJECT', properties: { fileId: S('OneDrive item id') }, required: ['fileId'] },
    run: (u, a) => analyse(u.graphToken, a.fileId),
    brief: (d) => `Analysed **${d.name}**.`,
  },
};
for (const t of Object.values(onedriveTools)) t.source = 'OneDrive';
