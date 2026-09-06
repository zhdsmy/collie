import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function Card({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

export function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  type?: string;
  icon?: ReactNode;
  htmlType?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  danger?: boolean;
  block?: boolean;
  loading?: boolean;
}) {
  const { htmlType, icon, type: visualType, danger: _danger, block: _block, loading: _loading, ...buttonProps } = props;
  return (
    <button {...buttonProps} type={htmlType ?? "button"} data-animal-type={visualType}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function Icon({ children, ...props }: HTMLAttributes<HTMLElement> & { icon?: unknown; size?: number | string }) {
  const { icon: _icon, size: _size, ...elementProps } = props;
  return <span {...elementProps}>{children}</span>;
}
