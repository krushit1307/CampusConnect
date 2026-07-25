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
}

export function useMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
) {
  return useTanstackMutation<TData, TError, TVariables, TContext>({
    mutationFn: options.mutationFn,
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
}

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
