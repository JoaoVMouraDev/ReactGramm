import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { MobileNav, Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";

export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const postId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();

  const { data: post, isLoading } = trpc.posts.getById.useQuery(
    { id: postId },
    { enabled: !!postId }
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-lg mx-auto px-4 py-6 pb-20 sm:pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-semibold">Post</h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : !post ? (
          <div className="text-center py-12">
            <p className="font-semibold">Post não encontrado</p>
          </div>
        ) : (
          <PostCard
            post={{
              ...post,
              hashtags: post.hashtags ?? [],
            }}
          />
        )}
      </main>

      <MobileNav />
    </div>
  );
}
