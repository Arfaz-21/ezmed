import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Mic, HelpCircle, Check, Clock, X, MessageSquare, Globe } from 'lucide-react';

interface VoiceCommandsHelpProps {
  language?: string;
}

// Translations for different languages
const TRANSLATIONS: Record<string, {
  title: string;
  description: string;
  categories: {
    taken: { title: string; commands: string[] };
    snooze: { title: string; commands: string[] };
    skip: { title: string; commands: string[] };
    help: { title: string; commands: string[] };
    cancel: { title: string; commands: string[] };
  };
  tips: string[];
}> = {
  'en-US': {
    title: 'Voice Commands',
    description: 'Say any of these commands when a reminder is active',
    categories: {
      taken: {
        title: 'Mark as Taken',
        commands: ['Taken', 'I took it', 'Done', 'Yes', 'OK', 'Already done'],
      },
      snooze: {
        title: 'Snooze Reminder',
        commands: ['Snooze', 'Later', 'Wait', 'Remind me later', 'Snooze 10 minutes', 'Snooze for 15 minutes'],
      },
      skip: {
        title: 'Skip Medication',
        commands: ['Skip', 'Skip this one', 'Not today'],
      },
      help: {
        title: 'Get Help',
        commands: ['Help', 'What can I say', 'Commands'],
      },
      cancel: {
        title: 'Stop Listening',
        commands: ['Cancel', 'Never mind', 'Stop'],
      },
    },
    tips: [
      'Speak clearly and at a normal pace',
      'Wait for the "Listening..." indicator before speaking',
      'You can say snooze times like "snooze 10 minutes"',
    ],
  },
  'es-ES': {
    title: 'Comandos de Voz',
    description: 'Diga cualquiera de estos comandos cuando un recordatorio esté activo',
    categories: {
      taken: {
        title: 'Marcar como Tomado',
        commands: ['Tomado', 'Lo tomé', 'Listo', 'Sí', 'Ya lo hice'],
      },
      snooze: {
        title: 'Posponer Recordatorio',
        commands: ['Posponer', 'Después', 'Espera', 'Recuérdame luego', 'Posponer 10 minutos'],
      },
      skip: {
        title: 'Omitir Medicación',
        commands: ['Omitir', 'Saltar', 'Hoy no'],
      },
      help: {
        title: 'Obtener Ayuda',
        commands: ['Ayuda', 'Qué puedo decir', 'Comandos'],
      },
      cancel: {
        title: 'Dejar de Escuchar',
        commands: ['Cancelar', 'Olvidalo', 'Parar'],
      },
    },
    tips: [
      'Hable claramente y a un ritmo normal',
      'Espere el indicador "Escuchando..." antes de hablar',
      'Puede decir tiempos como "posponer 10 minutos"',
    ],
  },
  'fr-FR': {
    title: 'Commandes Vocales',
    description: 'Dites une de ces commandes quand un rappel est actif',
    categories: {
      taken: {
        title: 'Marquer comme Pris',
        commands: ['Pris', 'Je l\'ai pris', 'Fait', 'Oui', 'Déjà fait'],
      },
      snooze: {
        title: 'Reporter le Rappel',
        commands: ['Reporter', 'Plus tard', 'Attends', 'Rappelle-moi plus tard', 'Reporter 10 minutes'],
      },
      skip: {
        title: 'Ignorer le Médicament',
        commands: ['Ignorer', 'Sauter', 'Pas aujourd\'hui'],
      },
      help: {
        title: 'Obtenir de l\'Aide',
        commands: ['Aide', 'Que puis-je dire', 'Commandes'],
      },
      cancel: {
        title: 'Arrêter l\'Écoute',
        commands: ['Annuler', 'Oublie', 'Stop'],
      },
    },
    tips: [
      'Parlez clairement et à un rythme normal',
      'Attendez l\'indicateur "Écoute..." avant de parler',
      'Vous pouvez dire des temps comme "reporter 10 minutes"',
    ],
  },
  'de-DE': {
    title: 'Sprachbefehle',
    description: 'Sagen Sie einen dieser Befehle wenn eine Erinnerung aktiv ist',
    categories: {
      taken: {
        title: 'Als Genommen Markieren',
        commands: ['Genommen', 'Habe ich genommen', 'Fertig', 'Ja', 'Schon gemacht'],
      },
      snooze: {
        title: 'Erinnerung Verschieben',
        commands: ['Verschieben', 'Später', 'Warte', 'Erinnere mich später', 'Verschieben 10 Minuten'],
      },
      skip: {
        title: 'Medikament Überspringen',
        commands: ['Überspringen', 'Heute nicht'],
      },
      help: {
        title: 'Hilfe Erhalten',
        commands: ['Hilfe', 'Was kann ich sagen', 'Befehle'],
      },
      cancel: {
        title: 'Aufhören Zuzuhören',
        commands: ['Abbrechen', 'Vergiss es', 'Stop'],
      },
    },
    tips: [
      'Sprechen Sie klar und in normalem Tempo',
      'Warten Sie auf die "Höre..." Anzeige bevor Sie sprechen',
      'Sie können Zeiten sagen wie "verschieben 10 Minuten"',
    ],
  },
  'pt-BR': {
    title: 'Comandos de Voz',
    description: 'Diga qualquer um destes comandos quando um lembrete estiver ativo',
    categories: {
      taken: {
        title: 'Marcar como Tomado',
        commands: ['Tomado', 'Eu tomei', 'Pronto', 'Sim', 'Já fiz'],
      },
      snooze: {
        title: 'Adiar Lembrete',
        commands: ['Adiar', 'Depois', 'Espere', 'Me lembre depois', 'Adiar 10 minutos'],
      },
      skip: {
        title: 'Pular Medicação',
        commands: ['Pular', 'Hoje não'],
      },
      help: {
        title: 'Obter Ajuda',
        commands: ['Ajuda', 'O que posso dizer', 'Comandos'],
      },
      cancel: {
        title: 'Parar de Ouvir',
        commands: ['Cancelar', 'Esquece', 'Parar'],
      },
    },
    tips: [
      'Fale claramente e em ritmo normal',
      'Aguarde o indicador "Ouvindo..." antes de falar',
      'Você pode dizer tempos como "adiar 10 minutos"',
    ],
  },
  'zh-CN': {
    title: '语音命令',
    description: '当提醒激活时说出这些命令',
    categories: {
      taken: {
        title: '标记为已服用',
        commands: ['已服用', '吃了', '完成', '是', '好了'],
      },
      snooze: {
        title: '延后提醒',
        commands: ['延后', '稍后', '等等', '稍后提醒我', '延后10分钟'],
      },
      skip: {
        title: '跳过药物',
        commands: ['跳过', '今天不要'],
      },
      help: {
        title: '获取帮助',
        commands: ['帮助', '我能说什么', '命令'],
      },
      cancel: {
        title: '停止收听',
        commands: ['取消', '算了', '停止'],
      },
    },
    tips: [
      '说话清晰,速度正常',
      '等待"正在收听..."指示器后再说话',
      '您可以说时间如"延后10分钟"',
    ],
  },
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'taken': return <Check className="h-4 w-4 text-success" />;
    case 'snooze': return <Clock className="h-4 w-4 text-warning" />;
    case 'skip': return <X className="h-4 w-4 text-destructive" />;
    case 'help': return <HelpCircle className="h-4 w-4 text-primary" />;
    case 'cancel': return <X className="h-4 w-4 text-muted-foreground" />;
    default: return <MessageSquare className="h-4 w-4" />;
  }
};

export default function VoiceCommandsHelp({ language = 'en-US' }: VoiceCommandsHelpProps) {
  const [open, setOpen] = useState(false);
  
  const translations = TRANSLATIONS[language] || TRANSLATIONS['en-US'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Voice Commands Help</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            {translations.title}
          </DialogTitle>
          <DialogDescription>
            {translations.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {Object.entries(translations.categories).map(([key, category]) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                {getCategoryIcon(key)}
                {category.title}
              </div>
              <div className="flex flex-wrap gap-2 ml-6">
                {category.commands.map((command, idx) => (
                  <Badge key={idx} variant="secondary" className="text-sm">
                    "{command}"
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 space-y-2">
          <p className="font-medium text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Tips
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {translations.tips.map((tip, idx) => (
              <li key={idx}>• {tip}</li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
