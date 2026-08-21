interface UseQueryOptions<TData, TError> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
}
export declare function useQuery<TData, TError = Error>({
  queryKey,
  queryFn,
  enabled,
}: UseQueryOptions<TData, TError>): {
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
};
export declare function useMutation<TData, TError = Error, TVariables = void, TContext = unknown>({
  mutationFn,
  onSuccess,
  onError,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
}): {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | undefined;
  error: TError | null;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
};
export declare function useInfiniteQuery<TData, TError = Error>({
  queryKey,
  queryFn,
  initialPageParam,
  getNextPageParam,
}: {
  queryKey: unknown[];
  queryFn: (context: { pageParam: number }) => Promise<TData>;
  initialPageParam?: number;
  getNextPageParam: (lastPage: TData, allPages: TData[]) => number | undefined;
}): {
  data: {
    pages: TData[];
  };
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  error: TError | null;
};
export {};
