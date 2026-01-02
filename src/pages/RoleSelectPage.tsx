import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RoleSelectPage() {
  const [loading, setLoading] = useState(false);
  const { setUserRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRoleSelect = async (role: 'patient' | 'caregiver') => {
    setLoading(true);
    const { error } = await setUserRole(role);
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Could not set role. Please try again.',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Role Set!',
        description: `You are now registered as a ${role}.`
      });
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-elderly-lg font-bold">Who are you?</CardTitle>
          <CardDescription className="text-lg">
            Select your role to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => handleRoleSelect('patient')}
            disabled={loading}
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-4 text-xl border-2 hover:border-primary hover:bg-primary/5"
          >
            <User className="h-16 w-16 text-primary" />
            <span className="font-semibold">I am a Patient</span>
          </Button>

          <Button
            onClick={() => handleRoleSelect('caregiver')}
            disabled={loading}
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-4 text-xl border-2 hover:border-secondary hover:bg-secondary/5"
          >
            <Users className="h-16 w-16 text-secondary" />
            <span className="font-semibold">I am a Caregiver</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
