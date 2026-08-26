import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskStatus } from "@/types/tasks";

export function useTasks(clubId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["tasks", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("club_id", clubId)
        .order("order_index", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }
      return data as Task[];
    },
    enabled: !!clubId,
  });
}

export function useUpdateTaskStatus(clubId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      status,
      order_index,
    }: {
      taskId: string;
      status: TaskStatus;
      order_index: number;
    }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ status, order_index, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Task;
    },
    onMutate: async ({ taskId, status, order_index }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", clubId] });

      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", clubId]);

      if (previousTasks) {
        // Optimistically update the cache
        const newTasks = previousTasks.map((task) =>
          task.id === taskId ? { ...task, status, order_index } : task,
        );
        // Ensure it's re-sorted correctly in the cache based on optimistic order_index
        newTasks.sort((a, b) => a.order_index - b.order_index);

        queryClient.setQueryData<Task[]>(["tasks", clubId], newTasks);
      }

      return { previousTasks };
    },
    onError: (err, newTodo, context) => {
      // Revert on error
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", clubId], context.previousTasks);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure synchronization
      queryClient.invalidateQueries({ queryKey: ["tasks", clubId] });
    },
  });
}
