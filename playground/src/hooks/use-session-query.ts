import { useQuery } from "@tanstack/react-query"

import { getSession } from "../lib/api"
import { queryKeys } from "./query-keys"

export const useSessionQuery = () => {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: getSession,
  })
}
