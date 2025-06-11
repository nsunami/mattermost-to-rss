export async function getPostReactions(): Promise<Record<string, any>> {
  try {
    const response = await fetch("/api/v1/reactions")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching post reactions:", error)
    throw error
  }
}
