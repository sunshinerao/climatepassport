type InfoTooltipProps = {
  tooltip: string;
};

type FieldLabelWithInfoProps = {
  label: string;
  tooltip: string;
};

export function InfoTooltip({ tooltip }: InfoTooltipProps) {
  return (
    <span className="field-info-icon" data-tooltip={tooltip} role="img" tabIndex={0}>
      i
    </span>
  );
}

export function FieldLabelWithInfo({ label, tooltip }: FieldLabelWithInfoProps) {
  return (
    <span className="field-label-with-info">
      {label}
      <InfoTooltip tooltip={tooltip} />
    </span>
  );
}