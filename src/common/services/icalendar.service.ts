import { Injectable } from "@nestjs/common";

/**
 * Servicio para generar archivos .ics (iCalendar) compatibles con Google Calendar,
 * Outlook, Apple Calendar y otros sistemas de calendario
 */
@Injectable()
export class ICalendarService {
  /**
   * Genera un archivo .ics (iCalendar) para un evento
   *
   * @param title Título del evento
   * @param description Descripción del evento
   * @param startTime Fecha/hora de inicio
   * @param endTime Fecha/hora de fin
   * @param location Ubicación o URL de la reunión
   * @param organizerEmail Email del organizador
   * @param attendeeEmails Lista de emails de los asistentes
   * @param timeZone Zona horaria (por defecto: America/Argentina/Buenos_Aires)
   * @returns Contenido del archivo .ics como string
   */
  generateICS(
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    location?: string,
    organizerEmail?: string,
    attendeeEmails: string[] = [],
    timeZone: string = "America/Argentina/Buenos_Aires"
  ): string {
    // Formatear fechas en formato iCalendar
    // Para DTSTAMP (siempre UTC con Z)
    const formatDateUTC = (date: Date): string => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hours = String(date.getUTCHours()).padStart(2, "0");
      const minutes = String(date.getUTCMinutes()).padStart(2, "0");
      const seconds = String(date.getUTCSeconds()).padStart(2, "0");
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    };

    // Para DTSTART/DTEND con TZID (hora local sin Z)
    const formatDateLocal = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };

    // Generar UID único para el evento
    const uid = `videollamada-${Date.now()}-${Math.random().toString(36).substring(2, 15)}@trabajoya.com`;

    // Escapar texto para formato iCalendar
    const escapeText = (text: string): string => {
      return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
    };

    // Construir el archivo .ics
    let ics = "BEGIN:VCALENDAR\r\n";
    ics += "VERSION:2.0\r\n";
    ics += "PRODID:-//TrabajoYa//VideoMeetings//ES\r\n";
    ics += "CALSCALE:GREGORIAN\r\n";
    ics += "METHOD:REQUEST\r\n";
    ics += "BEGIN:VEVENT\r\n";
    ics += `UID:${uid}\r\n`;
    ics += `DTSTAMP:${formatDateUTC(new Date())}\r\n`;
    ics += `DTSTART;TZID=${timeZone}:${formatDateLocal(startTime)}\r\n`;
    ics += `DTEND;TZID=${timeZone}:${formatDateLocal(endTime)}\r\n`;
    ics += `SUMMARY:${escapeText(title)}\r\n`;

    if (description) {
      ics += `DESCRIPTION:${escapeText(description)}\r\n`;
    }

    if (location) {
      ics += `LOCATION:${escapeText(location)}\r\n`;
    }

    if (organizerEmail) {
      ics += `ORGANIZER;CN=${escapeText(organizerEmail)}:MAILTO:${organizerEmail}\r\n`;
    }

    // Agregar asistentes
    attendeeEmails.forEach((email) => {
      ics += `ATTENDEE;CN=${escapeText(email)};RSVP=TRUE:MAILTO:${email}\r\n`;
    });

    // Recordatorios (15 minutos antes y 1 día antes)
    ics += "BEGIN:VALARM\r\n";
    ics += "TRIGGER:-PT15M\r\n";
    ics += "ACTION:DISPLAY\r\n";
    ics += `DESCRIPTION:Recordatorio: ${escapeText(title)}\r\n`;
    ics += "END:VALARM\r\n";

    ics += "BEGIN:VALARM\r\n";
    ics += "TRIGGER:-P1D\r\n";
    ics += "ACTION:EMAIL\r\n";
    ics += `DESCRIPTION:Recordatorio: ${escapeText(title)}\r\n`;
    ics += "END:VALARM\r\n";

    ics += "END:VEVENT\r\n";
    ics += "END:VCALENDAR\r\n";

    return ics;
  }

  /**
   * Genera un archivo .ics para una videollamada
   *
   * @param title Título de la videollamada
   * @param description Descripción de la videollamada
   * @param startTime Fecha/hora de inicio
   * @param endTime Fecha/hora de fin
   * @param meetingUrl URL de la reunión (Google Meet, Zoom, etc.)
   * @param creatorEmail Email del creador
   * @param invitedUserEmail Email del usuario invitado
   * @returns Contenido del archivo .ics como string
   */
  generateVideoMeetingICS(
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    meetingUrl?: string,
    creatorEmail?: string,
    invitedUserEmail?: string
  ): string {
    const attendees: string[] = [];
    if (creatorEmail) attendees.push(creatorEmail);
    if (invitedUserEmail && invitedUserEmail !== creatorEmail) {
      attendees.push(invitedUserEmail);
    }

    const location = meetingUrl || "Videollamada";

    return this.generateICS(
      title,
      description,
      startTime,
      endTime,
      location,
      creatorEmail,
      attendees
    );
  }
}

