import {
  useQuery as useTanstackQuery,
  useMutation as useTanstackMutation,
  useInfiniteQuery as useTanstackInfiniteQuery,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection for offline fallback
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => {
      const val = await get(key);
      return val === undefined ? null : val;
    },
    setItem: set,
    removeItem: del,
  },
});

export { QueryClient, QueryClientProvider, useQueryClient };

export function invalidateQueries(_predicate?: (key: string) => boolean): void {
  queryClient.invalidateQueries();
}

export function setQueryData(queryKey: readonly unknown[], data: unknown) {
  queryClient.setQueryData(queryKey, data);
}

export function getQueryData<T>(queryKey: readonly unknown[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

interface UseQueryOptions<TData, TError> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
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

interface UseInfiniteQueryOptions<TData, TError, TPageParam = number> {
  queryKey: unknown[];
  queryFn: (context: { pageParam: TPageParam }) => Promise<TData>;
  initialPageParam?: TPageParam;
  getNextPageParam: (lastPage: TData, allPages: TData[]) => TPageParam | undefined;
  enabled?: boolean;
}

export function useInfiniteQuery<TData = unknown, TError = Error, TPageParam = unknown>(
  options: UseInfiniteQueryOptions<TData, TError, TPageParam>,
) {
  return useTanstackInfiniteQuery<
    TData,
    TError,
    { pages: TData[]; pageParams: TPageParam[] },
    unknown[],
    TPageParam
  >({
    queryKey: options.queryKey,
    // @ts-expect-error - The initial parameter might be null or undefined depending on the caller
    queryFn: ({ pageParam }) => options.queryFn({ pageParam }),
    initialPageParam: options.initialPageParam as TPageParam,
    getNextPageParam: (lastPage, allPages) => options.getNextPageParam(lastPage, allPages),
    enabled: options.enabled,
  });
}
