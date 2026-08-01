import { useState, useEffect, useCallback, useRef } from "react";
import {
  useQuery as useTanstackQuery,
  useMutation as useTanstackMutation,
  useInfiniteQuery as useTanstackInfiniteQuery,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export { QueryClient, QueryClientProvider, useQueryClient };

interface UseQueryOptions<TData, TError> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

// Simple in-memory cache
const queryCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache helpers
export function getQueryData<T>(queryKey: unknown[]): T | undefined {
  const key = JSON.stringify(queryKey);
  const cached = queryCache.get(key);
  if (!cached) return undefined;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return undefined;
  }
  return cached.data as T;
}

export function setQueryData(queryKey: unknown[], data: unknown): void {
  const key = JSON.stringify(queryKey);
  queryCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateQueries(predicate?: (key: string) => boolean): void {
  if (predicate) {
    for (const key of queryCache.keys()) {
      if (predicate(key)) {
        queryCache.delete(key);
      }
    }
  } else {
    queryCache.clear();
  }
}

export function useQuery<TData, TError = Error>({
  queryKey,
  queryFn,
  enabled = true,
}: UseQueryOptions<TData, TError>) {
  const [data, setData] = useState<TData | undefined>(() => getQueryData<TData>(queryKey));
  const [error, setError] = useState<TError | null>(null);
  const [status, setStatus] = useState<QueryStatus>("pending");
  const [isFetching, setIsFetching] = useState(false);

  const queryKeyString = JSON.stringify(queryKey);
  const mountedRef = useRef(true);

  const fetchQuery = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    setIsFetching(true);
    setStatus("pending");
    try {
      const result = await queryFn();
      if (mountedRef.current) {
        setData(result);
        setQueryData(queryKey, result);
        setStatus("success");
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as TError);
        setStatus("error");
      }
    } finally {
      if (mountedRef.current) {
        setIsFetching(false);
      }
    }
  }, [queryKeyString, enabled, queryKey, queryFn]); // Serialize queryKey to avoid infinite loops

  useEffect(() => {
    mountedRef.current = true;
    // Check cache first
    const cached = getQueryData<TData>(queryKey);
    if (cached && enabled) {
      setData(cached);
      setStatus("success");
      setIsFetching(false);
    } else {
      fetchQuery();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [queryKeyString, enabled]); // Only refetch when queryKey or enabled changes

  return {
    data,
    error,
    isLoading: status === "pending" && isFetching,
    isPending: status === "pending",
    isError: status === "error",
    isSuccess: status === "success",
    isFetching,
    refetch: fetchQuery,
  };
}

export function useMutation<TData, TError = Error, TVariables = void, TContext = unknown>({
  mutationFn,
  onSuccess,
  onError,
  onMutate,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
}) {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<TError | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (variables: TVariables): Promise<TData> => {
    setIsPending(true);
    setError(null);
    let context: TContext | undefined = undefined;

    try {
      // Run onMutate for optimistic updates
      if (onMutate) {
        context = await onMutate(variables);
      }

      const result = await mutationFn(variables);
      setData(result);
      if (onSuccess) onSuccess(result, variables, context);
      return result;
    } catch (err) {
      setError(err as TError);
      if (onError) onError(err as TError, variables, context);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  const mutate = (variables: TVariables) => {
    mutateAsync(variables).catch(() => {});
  };
export function useQuery<TData = unknown, TError = Error>(options: UseQueryOptions<TData, TError>) {
  return useTanstackQuery<TData, TError>({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled,
    staleTime: options.staleTime,
    refetchInterval: options.refetchInterval,
  });
}

interface UseMutationOptions<TData, TError, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
  // Optional: enables optimistic updates. Return a snapshot/context value here,
  // then roll back using that same value in onError.
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void;
}

export function useMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
) {
  return useTanstackMutation<TData, TError, TVariables, TContext>({
    mutationFn: options.mutationFn,
    onSuccess: options.onSuccess,
    onError: options.onError,
    onMutate: options.onMutate,
    onSettled: options.onSettled,
  });
}

interface UseInfiniteQueryOptions<TData, TError> {
  queryKey: unknown[];
  queryFn: (context: { pageParam: number }) => Promise<TData>;
  initialPageParam?: number;
  getNextPageParam: (lastPage: TData, allPages: TData[]) => number | undefined;
}) {
  const [pages, setPages] = useState<TData[]>([]);
  const [error, setError] = useState<TError | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextPageParam, setNextPageParam] = useState<number | undefined>(initialPageParam);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(
    async (param: number, isNext: boolean) => {
      if (isNext) setIsFetchingNextPage(true);
      else setIsFetching(true);

      try {
        const data = await queryFn({ pageParam: param });
        if (mountedRef.current) {
          setPages((prev) => (isNext ? [...prev, data] : [data]));
          const next = getNextPageParam(data, isNext ? [...pages, data] : [data]);
          setNextPageParam(next);
          setHasNextPage(next !== undefined);
          setError(null);
          // Cache the pages
          setQueryData(queryKey, { pages: isNext ? [...pages, data] : [data] });
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err as TError);
        }
      } finally {
        if (mountedRef.current) {
          if (isNext) setIsFetchingNextPage(false);
          else setIsFetching(false);
        }
      }
    },
    [queryFn, getNextPageParam, pages, queryKey],
  );

  useEffect(() => {
    mountedRef.current = true;
    // Check cache first
    const cached = getQueryData<{ pages: TData[] }>(queryKey);
    if (cached) {
      setPages(cached.pages);
      const lastPage = cached.pages[cached.pages.length - 1];
      const next = getNextPageParam(lastPage, cached.pages);
      setNextPageParam(next);
      setHasNextPage(next !== undefined);
    } else {
      fetchPage(initialPageParam, false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, []); // Only fetch initial on mount

  const fetchNextPage = useCallback(() => {
    if (hasNextPage && nextPageParam !== undefined) {
      fetchPage(nextPageParam, true);
    }
  }, [hasNextPage, nextPageParam, fetchPage]);

  const refetch = useCallback(() => {
    fetchPage(initialPageParam, false);
  }, [fetchPage, initialPageParam]);
  enabled?: boolean;
}

export function useInfiniteQuery<TData = unknown, TError = Error>(
  options: UseInfiniteQueryOptions<TData, TError>,
) {
  return useTanstackInfiniteQuery<
    TData,
    TError,
    { pages: TData[]; pageParams: number[] },
    unknown[],
    number
  >({
    queryKey: options.queryKey,
    queryFn: ({ pageParam = 0 }) => options.queryFn({ pageParam: pageParam as number }),
    initialPageParam: options.initialPageParam ?? 0,
    getNextPageParam: (lastPage, allPages) => options.getNextPageParam(lastPage, allPages),
    enabled: options.enabled,
  });
}
