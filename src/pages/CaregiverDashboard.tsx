import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLinking } from '@/hooks/useLinking';
import { useMedications, MedicationLog } from '@/hooks/useMedications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  LogOut, Users, Link, Plus, Trash2, Edit2, 
  Check, Clock, AlertTriangle, Bell, Unlink 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CaregiverDashboard() {
  const { signOut } = useAuth();
  const { linkedPatient, loading: linkLoading, linkWithCode, unlinkCaregiver } = useLinking();
  const { toast } = useToast();
  
  const [linkCode, setLinkCode] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const handleLinkWithCode = async () => {
    if (!linkCode.trim()) {
      toast({ title: 'Enter Code', description: 'Please enter the patient code', variant: 'destructive' });
      return;
    }
    
    const { error } = await linkWithCode(linkCode.trim());
    if (error) {
      toast({ title: 'Link Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Link Requested!', description: 'Waiting for patient approval' });
      setShowLinkDialog(false);
      setLinkCode('');
    }
  };

  const handleUnlink = async () => {
    const { error } = await unlinkCaregiver();
    if (error) {
      toast({ title: 'Error', description: 'Could not unlink', variant: 'destructive' });
    } else {
      toast({ title: 'Unlinked', description: 'You are no longer linked to this patient' });
    }
  };

  if (!linkedPatient || linkedPatient.status !== 'approved') {
    return (
      <div className="min-h-screen bg-background p-4">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-10 w-10 text-secondary" />
            <h1 className="text-2xl font-bold">Caregiver</h1>
          </div>
          <Button variant="outline" size="icon" onClick={signOut} className="h-12 w-12">
            <LogOut className="h-6 w-6" />
          </Button>
        </header>

        <Card className="border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Link to a Patient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {linkedPatient?.status === 'pending' ? (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 text-warning mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">Waiting for Approval</p>
                <p className="text-muted-foreground">
                  The patient needs to approve your link request
                </p>
                <Button variant="outline" onClick={handleUnlink} className="mt-4">
                  Cancel Request
                </Button>
              </div>
            ) : (
              <>
                <p className="text-center text-muted-foreground">
                  Enter the 6-character code from your patient's app
                </p>
                <div className="space-y-4">
                  <Input
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g., ABC123)"
                    className="h-16 text-2xl text-center tracking-widest font-mono"
                    maxLength={6}
                  />
                  <Button 
                    onClick={handleLinkWithCode} 
                    className="w-full h-14 text-lg"
                    disabled={linkLoading || linkCode.length < 6}
                  >
                    <Link className="h-5 w-5 mr-2" />
                    Link to Patient
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <LinkedCaregiverDashboard 
      patientId={linkedPatient.patient_id} 
      onSignOut={signOut}
      onUnlink={handleUnlink}
    />
  );
}

function LinkedCaregiverDashboard({ 
  patientId, 
  onSignOut,
  onUnlink 
}: { 
  patientId: string; 
  onSignOut: () => void;
  onUnlink: () => void;
}) {
  const { 
    medications, 
    todayLogs, 
    addMedication, 
    updateMedication, 
    deleteMedication, 
    loading 
  } = useMedications(patientId);
  const { toast } = useToast();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMed, setEditingMed] = useState<string | null>(null);
  const [medForm, setMedForm] = useState({
    name: '',
    dosage: '',
    scheduled_time: '08:00',
    frequency: 'daily'
  });

  const resetForm = () => {
    setMedForm({ name: '', dosage: '', scheduled_time: '08:00', frequency: 'daily' });
    setEditingMed(null);
  };

  const handleAddMedication = async () => {
    if (!medForm.name.trim() || !medForm.dosage.trim()) {
      toast({ title: 'Missing Info', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    const { error } = await addMedication(medForm);
    if (error) {
      toast({ title: 'Error', description: 'Could not add medication', variant: 'destructive' });
    } else {
      toast({ title: 'Added!', description: 'Medication added successfully' });
      setShowAddDialog(false);
      resetForm();
    }
  };

  const handleUpdateMedication = async () => {
    if (!editingMed) return;

    const { error } = await updateMedication(editingMed, {
      name: medForm.name,
      dosage: medForm.dosage,
      scheduled_time: medForm.scheduled_time
    });
    if (error) {
      toast({ title: 'Error', description: 'Could not update medication', variant: 'destructive' });
    } else {
      toast({ title: 'Updated!', description: 'Medication updated successfully' });
      setEditingMed(null);
      resetForm();
    }
  };

  const handleDeleteMedication = async (id: string) => {
    const { error } = await deleteMedication(id);
    if (error) {
      toast({ title: 'Error', description: 'Could not delete medication', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Medication removed' });
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'taken': return <Check className="h-5 w-5 text-success" />;
      case 'snoozed': return <Clock className="h-5 w-5 text-warning" />;
      case 'missed': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default: return <Bell className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'taken': return 'bg-success/10';
      case 'snoozed': return 'bg-warning/10';
      case 'missed': return 'bg-destructive/10';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-secondary" />
          <h1 className="text-xl font-bold">Caregiver Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onUnlink} className="h-10 w-10">
            <Unlink className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={onSignOut} className="h-10 w-10">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Today's Status */}
      <Card className="mb-6 border-2 border-secondary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Today's Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : todayLogs.length === 0 ? (
            <p className="text-muted-foreground">No medications scheduled for today</p>
          ) : (
            <div className="space-y-2">
              {todayLogs.map(log => (
                <div 
                  key={log.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${getStatusBg(log.status)}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <p className="font-medium">{log.medications?.name}</p>
                      <p className="text-sm text-muted-foreground">{formatTime(log.scheduled_time)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="capitalize font-medium">{log.status}</span>
                    {log.snooze_count > 0 && (
                      <p className="text-xs text-warning">Snoozed {log.snooze_count}x</p>
                    )}
                    {log.action_taken_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.action_taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medication Management */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Medications</h2>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={resetForm}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Medication</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Medication Name</Label>
                <Input
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                  placeholder="e.g., Aspirin"
                />
              </div>
              <div className="space-y-2">
                <Label>Dosage</Label>
                <Input
                  value={medForm.dosage}
                  onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                  placeholder="e.g., 100mg"
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={medForm.scheduled_time}
                  onChange={(e) => setMedForm({ ...medForm, scheduled_time: e.target.value })}
                />
              </div>
              <Button onClick={handleAddMedication} className="w-full">
                Add Medication
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {medications.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No medications added yet</p>
            </CardContent>
          </Card>
        ) : (
          medications.map(med => (
            <Card key={med.id} className="border">
              {editingMed === med.id ? (
                <CardContent className="p-4 space-y-3">
                  <Input
                    value={medForm.name}
                    onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                    placeholder="Name"
                  />
                  <Input
                    value={medForm.dosage}
                    onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                    placeholder="Dosage"
                  />
                  <Input
                    type="time"
                    value={medForm.scheduled_time}
                    onChange={(e) => setMedForm({ ...medForm, scheduled_time: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateMedication} className="flex-1">Save</Button>
                    <Button variant="outline" onClick={resetForm}>Cancel</Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{med.name}</p>
                    <p className="text-sm text-muted-foreground">{med.dosage} • {formatTime(med.scheduled_time)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingMed(med.id);
                        setMedForm({
                          name: med.name,
                          dosage: med.dosage,
                          scheduled_time: med.scheduled_time,
                          frequency: med.frequency
                        });
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMedication(med.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
