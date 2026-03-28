export function SectionCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="card section-card">
      <div className="card-head section-card__head">
        <div className="section-card__title-block">
          <span className="section-card__eyebrow">Раздел</span>
          <h2>{title}</h2>
        </div>
        {actions && <div className="section-card__actions">{actions}</div>}
      </div>
      <div className="card-body section-card__body">{children}</div>
    </section>
  );
}
