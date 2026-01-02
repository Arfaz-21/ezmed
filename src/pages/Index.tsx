import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import PatientDashboard from './PatientDashboard';
import CaregiverDashboard from './CaregiverDashboard';
import RoleSelectPage from './RoleSelectPage';
import { Pill, Heart } from 'lucide-react';

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="flex justify-center mb-4 animate-pulse-gentle">
            <Pill className="h-16 w-16 text-primary" />
            <Heart className="h-12 w-12 text-destructive ml-2" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MedEase</h1>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to auth page
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Authenticated but no role selected
  if (!role) {
    return <RoleSelectPage />;
  }

  // Show appropriate dashboard based on role
  if (role === 'patient') {
    return <PatientDashboard />;
  }

  if (role === 'caregiver') {
    return <CaregiverDashboard />;
  }

  return <RoleSelectPage />;
};

export default Index;
