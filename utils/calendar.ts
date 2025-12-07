export function downloadIcsForMatch({eventName, opponentName, date, startTime}) {
  const icsContent = [
    `BEGIN:VCALENDAR`,
    `VERSION:2.0`,
    `BEGIN:VEVENT`,
    `SUMMARY:${eventName} - Partita vs ${opponentName}`,
    `DTSTART:${date.replace(/-/g, '')}T${startTime.replace(':', '')}00`,
    `DTEND:${date.replace(/-/g, '')}T${(+startTime.split(':')[0] + 1)}${startTime.split(':')[1]}00`,
    `DESCRIPTION:Partita torneo contro ${opponentName}`,
    `END:VEVENT`,
    `END:VCALENDAR`
  ].join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventName}_vs_${opponentName}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
