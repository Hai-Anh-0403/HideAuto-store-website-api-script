const rawBasePath = process.env.BASE_PATH?.trim() ?? "/";

function normalizeBasePath(value: string): string {
    if (value === "" || value === "/") return "";
    const ensuredLeadingSlash = value.startsWith("/") ? value : `/${value}`;
    return ensuredLeadingSlash.endsWith("/")
      ? ensuredLeadingSlash.slice(0, -1)
      : ensuredLeadingSlash;
  }

export const basePath = normalizeBasePath(rawBasePath);

export function withBasePath(pathname: `/${string}`): string {
    return basePath ? `${basePath}${pathname}` : pathname;
}