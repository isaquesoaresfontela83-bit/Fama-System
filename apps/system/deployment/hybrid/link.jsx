import { forwardRef } from "react";
export default forwardRef(function Link({href,prefetch,replace,scroll,shallow,locale,children,...props},ref){return <a ref={ref} href={typeof href === "string" ? href : href.pathname} {...props}>{children}</a>});
