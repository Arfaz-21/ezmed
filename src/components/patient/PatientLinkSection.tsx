import { useState } from 'react';
import { usePatientCode } from '@/hooks/usePatientCode';
import { useLinking } from '@/hooks/useLinking';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Key, RefreshCw, Check, X, Users, UserCheck } from 'lucide-react';

export default function PatientLinkSection() {
  const { code, generateCode, loading: codeLoading } = usePatientCode();
  const { pendingRequests, linkedCaregiver, approveRequest, rejectRequest, loading: linkLoading } = useLinking();
  const { toast } = useToast();

  const handleGenerateCode = async () => {
    const newCode = await generateCode();
    if (newCode) {
      toast({ 
        title: 'Code Generated!', 
        description: `Share this code: ${newCode}` 
      });
    } else {
      toast({ 
        title: 'Error', 
        description: 'Could not generate code', 
        variant: 'destructive' 
      });
    }
  };

  const handleApprove = async (requestId: string) => {
    const { error } = await approveRequest(requestId);
    if (error) {
      toast({ title: 'Error', description: 'Could not approve', variant: 'destructive' });
    } else {
      toast({ title: 'Approved!', description: 'Caregiver is now linked' });
    }
  };

  const handleReject = async (requestId: string) => {
    const { error } = await rejectRequest(requestId);
    if (error) {
      toast({ title: 'Error', description: 'Could not reject', variant: 'destructive' });
    } else {
      toast({ title: 'Rejected', description: 'Request has been declined' });
    }
  };

  // If already linked to a caregiver
  if (linkedCaregiver) {
    return (
      <Card className="mb-6 border-2 border-success/30 bg-success/5">
        <CardContent className="p-4 flex items-center gap-4">
          <UserCheck className="h-10 w-10 text-success" />
          <div>
            <p className="font-semibold text-lg">Caregiver Connected</p>
            <p className="text-sm text-muted-foreground">Your caregiver can manage your medications</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-2 border-warning bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Caregiver Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map(request => (
              <div key={request.id} className="space-y-3">
                <p className="text-center text-lg">
                  Someone wants to be your caregiver
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleApprove(request.id)}
                    disabled={linkLoading}
                    className="flex-1 h-16 text-lg bg-success hover:bg-success/90"
                  >
                    <Check className="h-6 w-6 mr-2" />
                    APPROVE
                  </Button>
                  <Button
                    onClick={() => handleReject(request.id)}
                    disabled={linkLoading}
                    variant="outline"
                    className="flex-1 h-16 text-lg border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-6 w-6 mr-2" />
                    REJECT
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Generate Code Section */}
      {pendingRequests.length === 0 && (
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Connect Caregiver
            </CardTitle>
          </CardHeader>
          <CardContent>
            {code ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Share this code with your caregiver:</p>
                <div className="text-4xl font-mono font-bold tracking-widest text-primary py-4 bg-muted rounded-lg">
                  {code}
                </div>
                <p className="text-sm text-muted-foreground">Code expires in 24 hours</p>
                <Button 
                  variant="outline" 
                  onClick={handleGenerateCode}
                  disabled={codeLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${codeLoading ? 'animate-spin' : ''}`} />
                  Generate New Code
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Generate a code to let your caregiver connect
                </p>
                <Button 
                  onClick={handleGenerateCode}
                  disabled={codeLoading}
                  className="h-14 text-lg gap-2"
                >
                  <Key className="h-5 w-5" />
                  Generate Link Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
