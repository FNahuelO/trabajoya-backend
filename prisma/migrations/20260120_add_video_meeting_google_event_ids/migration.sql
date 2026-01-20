-- Add Google Calendar event IDs to VideoMeeting
ALTER TABLE "VideoMeeting"
ADD COLUMN "googleEventIdCreator" TEXT,
ADD COLUMN "googleEventIdInvited" TEXT;



