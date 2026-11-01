// Microsoft Teams notifications: posts an adaptive card digest to a channel through an incoming webhook
// (Teams Workflows "Post to a channel when a webhook request is received"). Only sent when a user clicks the button.
export const teamsConfigured = () => Boolean(process.env.TEAMS_WEBHOOK_URL);

const SEV = { critical: 'Attention', serious: 'Warning', warning: 'Warning', info: 'Default', good: 'Good' };
const LABEL = { critical: 'Critical', serious: 'High', warning: 'Attention', info: 'Update', good: 'Good' };

export async function postDigest({ title, subtitle, items, appUrl }) {
  if (!teamsConfigured()) throw new Error('Teams is not configured. Add TEAMS_WEBHOOK_URL to .env (a Teams channel Workflows webhook).');
  const card = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
    body: [
      { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Large', wrap: true },
      { type: 'TextBlock', text: subtitle, isSubtle: true, spacing: 'None', wrap: true },
      ...items.slice(0, 12).map((n) => ({
        type: 'ColumnSet', spacing: 'Medium', separator: true,
        columns: [
          { type: 'Column', width: 'auto', items: [{ type: 'TextBlock', text: LABEL[n.severity] || 'Update', color: SEV[n.severity] || 'Default', weight: 'Bolder', size: 'Small' }] },
          { type: 'Column', width: 'stretch', items: [{ type: 'TextBlock', text: n.title, wrap: true, weight: 'Bolder' }, { type: 'TextBlock', text: n.detail, wrap: true, isSubtle: true, spacing: 'None', size: 'Small' }] },
        ],
      })),
    ],
    actions: appUrl ? [{ type: 'Action.OpenUrl', title: 'Open NTT DATA HRMS', url: appUrl }] : [],
  };
  const res = await fetch(process.env.TEAMS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card }] }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Teams rejected the message (${res.status}). Check that TEAMS_WEBHOOK_URL is a current Workflows webhook.`);
  return { sent: items.length };
}
