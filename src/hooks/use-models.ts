import { useQuery } from "@tanstack/react-query";
import { AIModel } from "@/types/ai";

export function useModels() {
  const query = useQuery<AIModel[]>({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await fetch("/api/v1/models");
      if (!res.ok) throw new Error("Gagal mengambil model");
      const json = await res.json();
      return json.data;
    },
    staleTime: 10 * 60 * 1000, // 10 min
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    models: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
