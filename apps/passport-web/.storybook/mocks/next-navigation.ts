import { useCallback, useMemo, useState } from "react";

export function useRouter() {
  const [, setPath] = useState("/");

  const push = useCallback((url: string) => {
    setPath(url);
    // eslint-disable-next-line no-console
    console.warn(`[Storybook mock] router.push(${url})`);
  }, []);

  const replace = useCallback((url: string) => {
    setPath(url);
    // eslint-disable-next-line no-console
    console.warn(`[Storybook mock] router.replace(${url})`);
  }, []);

  const refresh = useCallback(() => {
    // eslint-disable-next-line no-console
    console.warn("[Storybook mock] router.refresh()");
  }, []);

  const back = useCallback(() => {
    // eslint-disable-next-line no-console
    console.warn("[Storybook mock] router.back()");
  }, []);

  const forward = useCallback(() => {
    // eslint-disable-next-line no-console
    console.warn("[Storybook mock] router.forward()");
  }, []);

  return useMemo(
    () => ({
      push,
      replace,
      refresh,
      back,
      forward,
      pathname: "/",
      route: "/",
      query: {},
      asPath: "/",
      basePath: "",
      locale: undefined,
      locales: [],
      defaultLocale: undefined,
      isReady: true,
      isFallback: false,
      isPreview: false,
      isLocaleDomain: false,
      events: { on: () => {}, off: () => {}, emit: () => {} },
    }),
    [push, replace, refresh, back, forward]
  );
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function redirect(url: string, _type?: "replace" | "push") {
  // eslint-disable-next-line no-console
  console.warn(`[Storybook mock] redirect(${url})`);
}

export function notFound() {
  // eslint-disable-next-line no-console
  console.warn("[Storybook mock] notFound()");
}

export function useSelectedLayoutSegment() {
  return null;
}

export function useSelectedLayoutSegments() {
  return [];
}
