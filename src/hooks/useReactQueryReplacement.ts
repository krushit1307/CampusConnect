import { useState, useEffect, useCallback } from "react";

type QueryStatus = "pending" | "success" | "error";

interface UseQueryOptions<TData, TError> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
}

export function useQuery<TData, TError = Error>({
  queryKey,
  queryFn,
  enabled = true,
}: UseQueryOptions<TData, TError>) {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<TError | null>(null);
  const [status, setStatus] = useState<QueryStatus>("pending");
  const [isFetching, setIsFetching] = useState(false);

  const queryKeyString = JSON.stringify(queryKey);

  const fetchQuery = useCallback(async () => {
    if (!enabled) return;
    setIsFetching(true);
    setStatus("pending");
    try {
      const result = await queryFn();
      setData(result);
      setStatus("success");
      setError(null);
    } catch (err) {
      setError(err as TError);
      setStatus("error");
    } finally {
      setIsFetching(false);
    }
  }, [queryKeyString, enabled]); // Serialize queryKey to avoid infinite loops

  useEffect(() => {
    fetchQuery();
  }, [fetchQuery]);

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
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
}) {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<TError | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (variables: TVariables): Promise<TData> => {
    setIsPending(true);
    setError(null);
    try {
      const result = await mutationFn(variables);
      setData(result);
      if (onSuccess) onSuccess(result, variables, undefined);
      return result;
    } catch (err) {
      setError(err as TError);
      if (onError) onError(err as TError, variables, undefined);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  const mutate = (variables: TVariables) => {
    mutateAsync(variables).catch(() => {});
  };

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isPending,
    isError: error !== null,
    isSuccess: !isPending && error === null && data !== undefined,
    reset: () => {
      setError(null);
      setData(undefined);
    },
  };
}

export function useInfiniteQuery<TData, TError = Error>({
  queryKey,
  queryFn,
  initialPageParam = 0,
  getNextPageParam,
}: {
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

  const fetchPage = useCallback(
    async (param: number, isNext: boolean) => {
      if (isNext) setIsFetchingNextPage(true);
      else setIsFetching(true);

      try {
        const data = await queryFn({ pageParam: param });
        setPages((prev) => (isNext ? [...prev, data] : [data]));
        const next = getNextPageParam(data, isNext ? [...pages, data] : [data]);
        setNextPageParam(next);
        setHasNextPage(next !== undefined);
        setError(null);
      } catch (err) {
        setError(err as TError);
      } finally {
        if (isNext) setIsFetchingNextPage(false);
        else setIsFetching(false);
      }
    },
    [queryFn, getNextPageParam, pages],
  );

  useEffect(() => {
    fetchPage(initialPageParam, false);
  }, []); // Only fetch initial on mount

  const fetchNextPage = useCallback(() => {
    if (hasNextPage && nextPageParam !== undefined) {
      fetchPage(nextPageParam, true);
    }
  }, [hasNextPage, nextPageParam, fetchPage]);

  const refetch = useCallback(() => {
    fetchPage(initialPageParam, false);
  }, [fetchPage, initialPageParam]);

  return {
    data: { pages },
    isLoading: isFetching && pages.length === 0,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
  };
}
