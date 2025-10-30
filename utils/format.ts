export const formatDateLongWithTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    // toLocaleString è più sicuro per data+ora
    return d.toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });
  } catch {
    // fallback compatibile ovunque
    return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  }
};

export const formatDateShortWithTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    return d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return `${d.toLocaleDateString('it-IT')} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  }
};

export const formatDateShort = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    return d.toLocaleDateString('it-IT', { dateStyle: 'short' });
  } catch {
    return d.toLocaleDateString('it-IT');
  }
};
