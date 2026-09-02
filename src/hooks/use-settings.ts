import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserSettings } from "@/types/chat";
import { UpdateSettingsInput } from "@/lib/validation/settings";
import { useSession } from "next-auth/react";

export function useSettings() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuth = Boolean(session?.user?.id);

  const queryKey = ["settings", session?.user?.id || "guest"];

  const query = useQuery<UserSettings | null>({
    queryKey,
    enabled: isAuth,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      const res = await fetch("/api/v1/settings");
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Gagal mengambil pengaturan");
      }
      const json = await res.json();
      return json.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateSettingsInput) => {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Gagal memperbarui pengaturan");
      const json = await res.json();
      return json.data as UserSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    updateSettings: updateMutation.mutateAsync,
  };
}
