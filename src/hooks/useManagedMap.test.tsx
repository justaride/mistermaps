import { createRef } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useManagedMap } from "./useManagedMap";

type TestMap = {
  remove: () => void;
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useManagedMap", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a map once the container ref is mounted and removes it on unmount", async () => {
    const container = createRef<HTMLDivElement>();
    const remove = vi.fn();
    const map: TestMap = { remove };
    const createMap = vi.fn(async () => map);

    const { result, unmount } = renderHook(
      () =>
        useManagedMap({
          container,
          createMap,
        }),
      {
        wrapper: ({ children }) => <div ref={container}>{children}</div>,
      },
    );

    await waitFor(() => {
      expect(createMap).toHaveBeenCalledTimes(1);
      expect(createMap).toHaveBeenCalledWith(container.current);
    });

    await waitFor(() => {
      expect(result.current.mapRef.current).toBe(map);
    });

    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(result.current.mapRef.current).toBeNull();
  });

  it("removes a map that resolves after the hook has already unmounted", async () => {
    const container = createRef<HTMLDivElement>();
    const deferred = createDeferred<TestMap>();
    const createMap = vi.fn(() => deferred.promise);

    const { unmount } = renderHook(
      () =>
        useManagedMap({
          container,
          createMap,
        }),
      {
        wrapper: ({ children }) => <div ref={container}>{children}</div>,
      },
    );

    await waitFor(() => {
      expect(createMap).toHaveBeenCalledTimes(1);
    });

    unmount();

    const remove = vi.fn();
    const lateMap: TestMap = { remove };
    deferred.resolve(lateMap);

    await waitFor(() => {
      expect(remove).toHaveBeenCalledTimes(1);
    });
  });

  it("forwards creation errors to the optional error handler", async () => {
    const container = createRef<HTMLDivElement>();
    const error = new Error("map failed");
    const onCreateError = vi.fn();
    const createMap = vi.fn(async () => {
      throw error;
    });

    renderHook(
      () =>
        useManagedMap({
          container,
          createMap,
          onCreateError,
        }),
      {
        wrapper: ({ children }) => <div ref={container}>{children}</div>,
      },
    );

    await waitFor(() => {
      expect(onCreateError).toHaveBeenCalledTimes(1);
      expect(onCreateError).toHaveBeenCalledWith(error);
    });
  });
});
