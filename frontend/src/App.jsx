import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
const Login = lazy(() => import('./features/auth/Login'));
const Register = lazy(() => import('./features/auth/Register'));
const Home = lazy(() => import('./features/games/Home'));
const CreateGame = lazy(() => import('./features/games/CreateGame'));
const InvitationManagement = lazy(() => import('./features/invitations/InvitationManagement'));
const TurnOrderSetup = lazy(() => import('./features/turnOrder/TurnOrderSetup'));
const GameBoard = lazy(() => import('./features/rounds/GameBoard'));
const GameHistory = lazy(() => import('./features/games/GameHistory'));
const Profile = lazy(() => import('./features/users/Profile'));
import { Loader2 } from 'lucide-react';

const ScreenLoading = () => <div className="min-h-screen bg-slate-950 flex items-center justify-center" role="status">
  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" aria-hidden="true" /><span className="sr-only">Loading screen…</span>
</div>;

class ScreenBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">This screen could not be loaded</h1>
      <p role="alert">Check your connection and reload to try again.</p>
      <button onClick={() => window.location.reload()} className="bg-emerald-500 text-slate-950 rounded-xl px-5 py-3 font-semibold">Reload</button>
    </main>;
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <ScreenLoading />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScreenBoundary><Suspense fallback={<ScreenLoading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/create" 
            element={
              <ProtectedRoute>
                <CreateGame />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/lobby" 
            element={
              <ProtectedRoute>
                <InvitationManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/turn-order" 
            element={
              <ProtectedRoute>
                <TurnOrderSetup />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/board" 
            element={
              <ProtectedRoute>
                <GameBoard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/history" 
            element={
              <ProtectedRoute>
                <GameHistory />
              </ProtectedRoute>
            } 
          />
        </Routes>
        </Suspense></ScreenBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
