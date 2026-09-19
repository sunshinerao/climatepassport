import React from "react";

interface MockNextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: React.ReactNode;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  locale?: string | false;
  shallow?: boolean;
  passHref?: boolean;
}

const MockNextLink = React.forwardRef<HTMLAnchorElement, MockNextLinkProps>(
  ({ href, children, ...props }, ref) => {
    return (
      <a ref={ref} href={href} {...props}>
        {children}
      </a>
    );
  }
);

MockNextLink.displayName = "MockNextLink";
export default MockNextLink;
