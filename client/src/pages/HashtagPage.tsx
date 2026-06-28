import { trpc } from "@/lib/trpc";
import { ArrowLeft, Hash, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { Navbar } from "@/components/Navbar";

export default function HashtagPage() {
  const params = useParams<{ tag: string }>();
  const tag = params.tag ?? "";
  const [, navigate] = useLocation();

  const { data: posts, isLoading } = trpc.posts.byHashtag.useQuery(
    { hashtag: tag, limit: 30, offset: 0 },
    { enabled: !!tag }
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/explore")}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full ig-gradient flex items-center justify-center">
              <Hash size={24} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl">#{tag}</h1>
              {posts && (
                <p className="text-sm text-muted-foreground">
                  {posts.length} {posts.length === 1 ? "post" : "posts"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Posts grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-semibold text-base">Nenhum post com #{tag}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Seja o primeiro a usar essa hashtag!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((post: any) => (
              <button
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="aspect-square overflow-hidden bg-muted relative group"
              >
                <img
                  src={post.imageUrl}
                  alt={post.caption ?? ""}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-3 text-white text-sm font-semibold">
                    <span>❤️ {post.likesCount}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

    </div>
  );
}
