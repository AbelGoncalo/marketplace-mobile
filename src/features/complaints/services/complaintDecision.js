/** Extrai apenas o desfecho real; o histórico mantém compatibilidade com versões anteriores da API. */
export function complaintDecision(complaint) {
  if (!['RESOLVED', 'REJECTED'].includes(complaint?.status)) return null;
  const rejected = complaint.status === 'REJECTED';
  const events = Array.isArray(complaint.timeline) ? complaint.timeline : [];
  const finalEvent = events
    .filter((event) => event.to_status === complaint.status)
    .reduce((latest, event) => {
      const timestamp = Date.parse(event.occurred_at) || 0;
      return !latest || timestamp >= (Date.parse(latest.occurred_at) || 0) ? event : latest;
    }, null);
  const resolution = typeof complaint.resolution === 'string' ? complaint.resolution.trim() : '';
  const notes = typeof finalEvent?.notes === 'string' ? finalEvent.notes.trim() : '';
  return {
    rejected,
    label: rejected ? 'Justificação da rejeição' : 'Solução apresentada',
    text: resolution || notes || 'A decisão foi registada sem descrição disponível.',
    date: (rejected ? complaint.rejected_at : complaint.resolved_at) || finalEvent?.occurred_at,
    dateLabel: rejected ? 'Rejeitada em' : 'Resolvida em',
  };
}
