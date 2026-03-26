import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, Loader2, Check, X, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ScanResult {
  medicine_name: string;
  dosage: string | null;
  confidence: 'high' | 'medium' | 'low';
  raw_text: string;
}

interface MedicineScannerProps {
  onConfirm: (name: string, dosage: string, imageUrl: string | null) => void;
  onCancel: () => void;
}

export default function MedicineScanner({ onConfirm, onCancel }: MedicineScannerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedDosage, setEditedDosage] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Reset scan result
    setScanResult(null);
  };

  const resizeImage = (dataUrl: string, maxSize = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = dataUrl;
    });
  };

  const scanImage = async () => {
    if (!imagePreview) return;

    setScanning(true);
    try {
      const resized = await resizeImage(imagePreview, 600);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const { data, error } = await supabase.functions.invoke('scan-medicine', {
        body: { imageBase64: resized },
      });

      clearTimeout(timeout);

      if (error) throw error;

      console.log('Scan result:', data);
      setScanResult(data);
      setEditedName(data.medicine_name || '');
      setEditedDosage(data.dosage || '');

      toast({
        title: 'Scan complete!',
        description: data.confidence === 'high' 
          ? 'Medicine detected with high confidence' 
          : 'Please verify the detected information'
      });
    } catch (error: any) {
      console.error('Scan error:', error);
      const msg = error.name === 'AbortError' 
        ? 'Scan took too long. Try a clearer photo.'
        : (error.message || 'Could not analyze the image');
      toast({
        title: 'Scan failed',
        description: msg,
        variant: 'destructive'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleConfirm = async () => {
    if (!editedName.trim()) {
      toast({ title: 'Enter name', description: 'Please enter a medicine name', variant: 'destructive' });
      return;
    }

    setUploading(true);
    let imageUrl: string | null = null;

    try {
      // Upload image if we have one
      if (imageFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fileName = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('medicine-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        // Use signed URL instead of public URL for privacy
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('medicine-images')
          .createSignedUrl(fileName, 604800); // 7 days expiry

        if (signedError) throw signedError;
        imageUrl = signedUrlData.signedUrl;
      }

      onConfirm(editedName.trim(), editedDosage.trim(), imageUrl);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Could not upload image',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-success';
      case 'medium': return 'text-warning';
      default: return 'text-destructive';
    }
  };

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Medicine Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image upload area */}
        {!imagePreview ? (
          <div 
            className="border-2 border-dashed border-muted rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">
              Take a photo or upload an image of the medicine
            </p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image preview */}
            <div className="relative">
              <img 
                src={imagePreview} 
                alt="Medicine" 
                className="w-full h-48 object-cover rounded-lg border"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  setScanResult(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scan button */}
            {!scanResult && (
              <Button 
                onClick={scanImage} 
                className="w-full" 
                disabled={scanning}
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Scan Medicine
                  </>
                )}
              </Button>
            )}

            {/* Scan results */}
            {scanResult && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AI Detection</span>
                  <span className={`text-sm font-medium ${getConfidenceColor(scanResult.confidence)}`}>
                    {scanResult.confidence} confidence
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="medName">Medicine Name</Label>
                    <Input
                      id="medName"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      placeholder="Enter medicine name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dosage">Dosage</Label>
                    <Input
                      id="dosage"
                      value={editedDosage}
                      onChange={(e) => setEditedDosage(e.target.value)}
                      placeholder="e.g., 100mg"
                    />
                  </div>
                </div>

                {scanResult.raw_text && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      View detected text
                    </summary>
                    <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto max-h-24">
                      {scanResult.raw_text}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          {scanResult && (
            <Button 
              onClick={handleConfirm} 
              className="flex-1"
              disabled={uploading || !editedName.trim()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm & Add
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
