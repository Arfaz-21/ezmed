import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEmergencyAlert } from '@/hooks/useEmergencyAlert';
import { useToast } from '@/hooks/use-toast';
import { Phone, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function HelpButton() {
  const { sendEmergencyAlert, sending } = useEmergencyAlert();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleSendAlert = async () => {
    const { error } = await sendEmergencyAlert();
    
    if (error) {
      toast({ 
        title: 'Could not send alert', 
        description: error.message, 
        variant: 'destructive' 
      });
    } else {
      toast({ 
        title: '🚨 Help Alert Sent!', 
        description: 'Your caregiver has been notified immediately' 
      });
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          size="lg"
          className="w-full h-20 text-elderly-lg font-bold bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 shadow-lg shadow-destructive/25"
        >
          <Phone className="h-8 w-8 mr-3" />
          HELP
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-elderly text-center">
            Send Help Alert?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-lg text-center">
            This will immediately notify your caregiver that you need help.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
          <AlertDialogAction 
            onClick={handleSendAlert}
            disabled={sending}
            className="w-full h-14 text-lg bg-destructive hover:bg-destructive/90"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Phone className="h-5 w-5 mr-2" />
            )}
            Yes, Send Alert
          </AlertDialogAction>
          <AlertDialogCancel className="w-full h-12 text-lg">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
