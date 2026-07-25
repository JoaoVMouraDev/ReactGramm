import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import UploadPost from "./pages/UploadPost";
import Explore from "./pages/Explore";
import HashtagPage from "./pages/HashtagPage";
import PostDetail from "./pages/PostDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Messages from "./pages/Messages";
import SavedPosts from "./pages/SavedPosts";

function Router() {
  return (
    <Switch>
      {/* Rotas estáticas primeiro */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/upload" component={UploadPost} />
      <Route path="/explore" component={Explore} />
      <Route path="/messages" component={Messages} />
      <Route path="/saved" component={SavedPosts} />

      {/* Rotas dinâmicas depois */}
      <Route path="/profile/:username" component={Profile} />
      <Route path="/hashtag/:tag" component={HashtagPage} />
      <Route path="/post/:id" component={PostDetail} />

      {/* Catch-all para 404 - sempre por último */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
