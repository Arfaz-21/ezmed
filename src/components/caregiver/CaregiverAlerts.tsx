import { useState } from 'react';
import { useCaregiverAlerts, CaregiverAlert } from '@/hooks/useCaregiverAlerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, Check, AlertTriangle, Clock, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function CaregiverAlerts() {
  const { alerts, unreadCount, loading, markAsRead, markAllAsRead } = useCaregiverAlerts();
  const [open, setOpen] = useState(false);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'missed':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'multiple_snooze':
        return <Clock className="h-5 w-5 text-warning" />;
      default:
        return <Bell className="h-5 w-5 text-primary" />;
    }
  };

  const getAlertBg = (alert: CaregiverAlert) => {
    if (alert.is_read) return 'bg-muted/30';
    switch (alert.alert_type) {
      case 'missed':
        return 'bg-destructive/10 border-destructive/30';
      case 'multiple_snooze':
        return 'bg-warning/10 border-warning/30';
      default:
        return 'bg-primary/10 border-primary/30';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-10 w-10">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 text-destructive" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Alerts
            </SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : alerts.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="p-6 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No alerts yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  You'll be notified when patient misses or snoozes medications
                </p>
              </CardContent>
            </Card>
          ) : (
            alerts.map(alert => (
              <Card 
                key={alert.id} 
                className={`border transition-all ${getAlertBg(alert)} ${!alert.is_read ? 'shadow-md' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-background">
                      {getAlertIcon(alert.alert_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Badge 
                          variant={alert.alert_type === 'missed' ? 'destructive' : 'secondary'}
                          className="capitalize"
                        >
                          {alert.alert_type.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(alert.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{alert.message}</p>
                      {!alert.is_read && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2 h-7 text-xs"
                          onClick={() => markAsRead(alert.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
