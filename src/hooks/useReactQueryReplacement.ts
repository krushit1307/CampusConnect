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
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export { QueryClient, QueryClientProvider, useQueryClient };

// --------------------
// Query
// --------------------

interface UseQueryOptions<TData, TError> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

const queryCache = new Map<
  string,
  {
    data: unknown;
    timestamp: number;
  }
>();

const CACHE_TTL = 5 * 60 * 1000;

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

export function setQueryData(queryKey: unknown[], data: unknown) {
  const key = JSON.stringify(queryKey);

  queryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateQueries(predicate?: (key: string) => boolean) {
  if (!predicate) {
    queryCache.clear();
    return;
  }

  for (const key of queryCache.keys()) {
    if (predicate(key)) {
      queryCache.delete(key);
    }
  }
}

export function useQuery<TData = unknown, TError = Error>(options: UseQueryOptions<TData, TError>) {
  return useTanstackQuery<TData, TError>({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled,
    staleTime: options.staleTime,
    refetchInterval: options.refetchInterval,
  });
}

// --------------------
// Mutation
// --------------------

interface UseMutationOptions<TData, TError, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;

  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;

  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;

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

// --------------------
// Infinite Query
// --------------------

interface UseInfiniteQueryOptions<TData, TError> {
  queryKey: unknown[];

  queryFn: (context: { pageParam: number }) => Promise<TData>;

  initialPageParam?: number;

  getNextPageParam: (lastPage: TData, allPages: TData[]) => number | undefined;

  enabled?: boolean;
}

export function useInfiniteQuery<TData = unknown, TError = Error>(
  options: UseInfiniteQueryOptions<TData, TError>,
) {
  return useTanstackInfiniteQuery<
    TData,
    TError,
    {
      pages: TData[];
      pageParams: number[];
    },
    unknown[],
    number
  >({
    queryKey: options.queryKey,

    queryFn: ({ pageParam = 0 }) =>
      options.queryFn({
        pageParam: pageParam as number,
      }),

    initialPageParam: options.initialPageParam ?? 0,

    getNextPageParam: (lastPage, allPages) => options.getNextPageParam(lastPage, allPages),

    enabled: options.enabled,
  });
}
