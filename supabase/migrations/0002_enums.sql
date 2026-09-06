-- =====================================================================
-- Zirtan — 0002 · Enum tipleri
-- `src/domain/enums.ts` dosyasından birebir türetilmiştir.
-- Kaynak değiştiğinde: node supabase/seed/export-seed.mjs --enums-only
-- ile yeniden üretilebilir (yalnızca karşılaştırma amaçlı).
-- =====================================================================

SET search_path = public, extensions;

-- ADVENTURE_TYPES (8)
DO $$ BEGIN
  CREATE TYPE adventure_type AS ENUM ('hiking', 'climbing', 'diving', 'skiing', 'cycling', 'paragliding', 'rafting', 'canoe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DIFFICULTY_GRADES (5)
DO $$ BEGIN
  CREATE TYPE difficulty_grade AS ENUM ('beginner', 'easy', 'moderate', 'hard', 'extreme');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TRAIL_CONDITIONS (5)
DO $$ BEGIN
  CREATE TYPE trail_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MATCH_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NOTIFICATION_TYPES (25)
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('match_request', 'match_accepted', 'match_rejected', 'message', 'like', 'comment', 'follow', 'booking_request', 'booking_confirmed', 'booking_declined', 'hazard_alert', 'hazard_confirmed', 'stream_live', 'sos_alert', 'stay_request', 'stay_confirmed', 'story_posted', 'reaction', 'mention', 'repost', 'group_invite', 'group_message', 'trip_overdue', 'course_enrolled', 'certificate_issued');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HAZARD_TYPES (8)
DO $$ BEGIN
  CREATE TYPE hazard_type AS ENUM ('rockfall', 'avalanche', 'flood', 'wildlife', 'weather', 'trail_damage', 'closure', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HAZARD_SEVERITIES (4)
DO $$ BEGIN
  CREATE TYPE hazard_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HAZARD_STATUSES (2)
DO $$ BEGIN
  CREATE TYPE hazard_status AS ENUM ('active', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- STREAM_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE stream_status AS ENUM ('scheduled', 'live', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LISTING_CATEGORIES (7)
DO $$ BEGIN
  CREATE TYPE listing_category AS ENUM ('equipment', 'clothing', 'footwear', 'camping', 'electronics', 'rental', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LISTING_CONDITIONS (4)
DO $$ BEGIN
  CREATE TYPE listing_condition AS ENUM ('new', 'like_new', 'good', 'fair');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BOOKING_STATUSES (4)
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'declined', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PLACE_KINDS (13)
DO $$ BEGIN
  CREATE TYPE place_kind AS ENUM ('campsite', 'climbing', 'diving', 'dive_centre', 'hiking_route', 'rafting', 'canoe', 'paragliding', 'ski', 'peak', 'cave', 'viewpoint', 'shelter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SHARE_MODES (3)
DO $$ BEGIN
  CREATE TYPE share_mode AS ENUM ('friends', 'matches', 'sos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- STREAM_SOURCES (2)
DO $$ BEGIN
  CREATE TYPE stream_source AS ENUM ('camera', 'drone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BUSINESS_TYPES (8)
DO $$ BEGIN
  CREATE TYPE business_type AS ENUM ('hotel', 'pension', 'campsite', 'glamping', 'shop', 'rental', 'tour_operator', 'dive_center');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PLANS (4)
DO $$ BEGIN
  CREATE TYPE plan AS ENUM ('free', 'pro', 'pro_guide', 'business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- STAY_STATUSES (4)
DO $$ BEGIN
  CREATE TYPE stay_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EMERGENCY_CENTER_TYPES (6)
DO $$ BEGIN
  CREATE TYPE emergency_center_type AS ENUM ('hospital', 'ambulance', 'mountain_rescue', 'pharmacy', 'ranger', 'coast_guard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FIRST_AID_CATEGORIES (4)
DO $$ BEGIN
  CREATE TYPE first_aid_category AS ENUM ('critical', 'injury', 'environment', 'animal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- GRADE_SYSTEMS (5)
DO $$ BEGIN
  CREATE TYPE grade_system AS ENUM ('french', 'yds', 'uiaa', 'font', 'v_scale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CLIMB_TYPES (6)
DO $$ BEGIN
  CREATE TYPE climb_type AS ENUM ('sport', 'trad', 'boulder', 'multipitch', 'ice', 'alpine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ASCENT_STYLES (5)
DO $$ BEGIN
  CREATE TYPE ascent_style AS ENUM ('onsight', 'flash', 'redpoint', 'toprope', 'attempt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VERIFICATION_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('unverified', 'community', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SAT_DEVICE_TYPES (5)
DO $$ BEGIN
  CREATE TYPE sat_device_type AS ENUM ('inreach', 'zoleo', 'spot', 'phone_satellite', 'starlink_mini');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SAT_MESSAGE_STATUSES (5)
DO $$ BEGIN
  CREATE TYPE sat_message_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SAT_MESSAGE_KINDS (4)
DO $$ BEGIN
  CREATE TYPE sat_message_kind AS ENUM ('checkin', 'text', 'sos', 'location');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SOS_STAGES (6)
DO $$ BEGIN
  CREATE TYPE sos_stage AS ENUM ('idle', 'armed', 'sent', 'acknowledged', 'dispatched', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LINK_TYPES (4)
DO $$ BEGIN
  CREATE TYPE link_type AS ENUM ('cellular', 'wifi', 'satellite', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ROUTE_PROFILES (5)
DO $$ BEGIN
  CREATE TYPE route_profile AS ENUM ('hike', 'trail_run', 'mtb', 'gravel', 'ski_tour');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SURFACES (6)
DO $$ BEGIN
  CREATE TYPE surface AS ENUM ('trail', 'rock', 'scree', 'snow', 'gravel', 'paved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MAP_PACK_STATUSES (4)
DO $$ BEGIN
  CREATE TYPE map_pack_status AS ENUM ('available', 'downloading', 'downloaded', 'update_available');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CANCELLATION_POLICIES (3)
DO $$ BEGIN
  CREATE TYPE cancellation_policy AS ENUM ('flexible', 'moderate', 'strict');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PAYMENT_STATUSES (6)
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'escrow', 'released', 'refunded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HOST_VERIFICATION_LEVELS (4)
DO $$ BEGIN
  CREATE TYPE host_verification_level AS ENUM ('none', 'id', 'address', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UNIT_KINDS (5)
DO $$ BEGIN
  CREATE TYPE unit_kind AS ENUM ('room', 'tent_pitch', 'bungalow', 'dorm_bed', 'rv_spot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CLUB_ROLES (3)
DO $$ BEGIN
  CREATE TYPE club_role AS ENUM ('member', 'officer', 'president');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MEMBERSHIP_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('none', 'requested', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CLUB_EVENT_KINDS (5)
DO $$ BEGIN
  CREATE TYPE club_event_kind AS ENUM ('trip', 'training', 'social', 'competition', 'talk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BADGE_TIERS (4)
DO $$ BEGIN
  CREATE TYPE badge_tier AS ENUM ('bronze', 'silver', 'gold', 'legend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CHALLENGE_PERIODS (3)
DO $$ BEGIN
  CREATE TYPE challenge_period AS ENUM ('weekly', 'monthly', 'seasonal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LEADERBOARD_SCOPES (4)
DO $$ BEGIN
  CREATE TYPE leaderboard_scope AS ENUM ('friends', 'city', 'club', 'global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- XP_SOURCES (8)
DO $$ BEGIN
  CREATE TYPE xp_source AS ENUM ('post', 'route', 'ascent', 'hazard_report', 'challenge', 'quiz', 'event', 'streak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AI_INTENTS (8)
DO $$ BEGIN
  CREATE TYPE ai_intent AS ENUM ('plan_trip', 'safety_brief', 'packing_list', 'find_place', 'gear_advice', 'first_aid', 'weather', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AI_ROLES (2)
DO $$ BEGIN
  CREATE TYPE ai_role AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- STAGE_KINDS (9)
DO $$ BEGIN
  CREATE TYPE stage_kind AS ENUM ('trailhead', 'village', 'teahouse', 'camp', 'hut', 'base_camp', 'pass', 'summit', 'viewpoint');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TRANSPORT_MODES (7)
DO $$ BEGIN
  CREATE TYPE transport_mode AS ENUM ('flight', 'bus', 'jeep', 'train', 'ferry', 'trek', 'taxi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DESTINATION_TYPES (6)
DO $$ BEGIN
  CREATE TYPE destination_type AS ENUM ('trek', 'expedition', 'climbing_area', 'dive_region', 'ski_region', 'multi_sport');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TRIP_PLAN_STATUSES (5)
DO $$ BEGIN
  CREATE TYPE trip_plan_status AS ENUM ('planned', 'active', 'overdue', 'returned', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VISION_SITUATIONS (10)
DO $$ BEGIN
  CREATE TYPE vision_situation AS ENUM ('terrain', 'weather', 'gear', 'injury', 'wildlife', 'plant', 'map', 'water', 'camp', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RISK_LEVELS (4)
DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'moderate', 'high', 'extreme');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- POST_KINDS (3)
DO $$ BEGIN
  CREATE TYPE post_kind AS ENUM ('adventure', 'status', 'photo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- REACTION_TYPES (5)
DO $$ BEGIN
  CREATE TYPE reaction_type AS ENUM ('like', 'love', 'wow', 'fire', 'strong');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FEED_TABS (4)
DO $$ BEGIN
  CREATE TYPE feed_tab AS ENUM ('all', 'following', 'adventures', 'status');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- GROUP_KINDS (2)
DO $$ BEGIN
  CREATE TYPE group_kind AS ENUM ('group', 'channel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- GROUP_PRIVACIES (2)
DO $$ BEGIN
  CREATE TYPE group_privacy AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- GROUP_ROLES (3)
DO $$ BEGIN
  CREATE TYPE group_role AS ENUM ('member', 'admin', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- GROUP_MESSAGE_TYPES (6)
DO $$ BEGIN
  CREATE TYPE group_message_type AS ENUM ('text', 'image', 'location', 'route', 'poll', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COURSE_CATEGORIES (12)
DO $$ BEGIN
  CREATE TYPE course_category AS ENUM ('mountaineering', 'climbing', 'avalanche', 'first_aid', 'navigation', 'diving', 'paragliding', 'paddling', 'winter', 'drone', 'ethics', 'photography');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COURSE_FORMATS (3)
DO $$ BEGIN
  CREATE TYPE course_format AS ENUM ('online', 'in_person', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COURSE_LEVELS (4)
DO $$ BEGIN
  CREATE TYPE course_level AS ENUM ('beginner', 'intermediate', 'advanced', 'professional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LESSON_TYPES (4)
DO $$ BEGIN
  CREATE TYPE lesson_type AS ENUM ('video', 'reading', 'quiz', 'practical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ENROLLMENT_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TRACK_SOURCES (8)
DO $$ BEGIN
  CREATE TYPE track_source AS ENUM ('recorded', 'gpx', 'strava', 'komoot', 'alltrails', 'wikiloc', 'garmin', 'media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TRACK_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE track_status AS ENUM ('draft', 'published', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- POI_KINDS (11)
DO $$ BEGIN
  CREATE TYPE poi_kind AS ENUM ('campsite', 'water', 'viewpoint', 'shelter', 'danger', 'junction', 'summit', 'parking', 'food', 'trailhead', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- POI_SOURCES (6)
DO $$ BEGIN
  CREATE TYPE poi_source AS ENUM ('user', 'story', 'stream', 'post', 'track', 'osm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NAV_MANEUVERS (11)
DO $$ BEGIN
  CREATE TYPE nav_maneuver AS ENUM ('start', 'continue', 'slight_left', 'left', 'sharp_left', 'slight_right', 'right', 'sharp_right', 'uturn', 'waypoint', 'arrive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VISA_TYPES (5)
DO $$ BEGIN
  CREATE TYPE visa_type AS ENUM ('visa_free', 'e_visa', 'on_arrival', 'embassy', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ARTICLE_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE article_status AS ENUM ('draft', 'published', 'featured');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ARTICLE_CATEGORIES (7)
DO $$ BEGIN
  CREATE TYPE article_category AS ENUM ('trip_report', 'guide', 'gear', 'safety', 'culture', 'photography', 'opinion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SPECIES_GROUPS (8)
DO $$ BEGIN
  CREATE TYPE species_group AS ENUM ('snake', 'mammal', 'insect', 'arachnid', 'marine', 'bird', 'plant', 'fungus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DANGER_LEVELS (4)
DO $$ BEGIN
  CREATE TYPE danger_level AS ENUM ('harmless', 'caution', 'dangerous', 'deadly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DETERRENT_ANIMALS (9)
DO $$ BEGIN
  CREATE TYPE deterrent_animal AS ENUM ('bear', 'wolf', 'boar', 'dog', 'snake', 'jackal', 'monkey', 'elephant', 'big_cat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DETERRENT_SOUNDS (8)
DO $$ BEGIN
  CREATE TYPE deterrent_sound AS ENUM ('air_horn', 'siren', 'whistle', 'shout', 'clap', 'metal_clang', 'ultrasonic', 'stomp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- QUESTION_STATUSES (3)
DO $$ BEGIN
  CREATE TYPE question_status AS ENUM ('open', 'answered', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DOCTOR_SPECIALTIES (9)
DO $$ BEGIN
  CREATE TYPE doctor_specialty AS ENUM ('emergency', 'toxicology', 'wilderness', 'orthopedics', 'dermatology', 'general', 'pediatrics', 'dive_medicine', 'altitude_medicine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CONSULT_STATUSES (4)
DO $$ BEGIN
  CREATE TYPE consult_status AS ENUM ('requested', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CONSULT_URGENCIES (4)
DO $$ BEGIN
  CREATE TYPE consult_urgency AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TV_CHANNEL_KINDS (5)
DO $$ BEGIN
  CREATE TYPE tv_channel_kind AS ENUM ('documentary', 'news', 'live', 'education', 'community');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TV_PROGRAM_KINDS (6)
DO $$ BEGIN
  CREATE TYPE tv_program_kind AS ENUM ('documentary', 'news', 'series', 'short', 'live_replay', 'tutorial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NEWS_CATEGORIES (7)
DO $$ BEGIN
  CREATE TYPE news_category AS ENUM ('weather', 'closure', 'rescue', 'event', 'gear', 'community', 'science');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HERITAGE_ERAS (16)
DO $$ BEGIN
  CREATE TYPE heritage_era AS ENUM ('prehistoric', 'hittite', 'urartu', 'phrygian', 'lycian', 'greek', 'roman', 'byzantine', 'seljuk', 'ottoman', 'inca', 'maya', 'khmer', 'nabataean', 'egyptian', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HERITAGE_KINDS (10)
DO $$ BEGIN
  CREATE TYPE heritage_kind AS ENUM ('ancient_city', 'temple', 'castle', 'monastery', 'underground_city', 'rock_art', 'tomb', 'sunken_city', 'museum', 'bridge');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- KID_AGE_BANDS (4)
DO $$ BEGIN
  CREATE TYPE kid_age_band AS ENUM ('0_3', '4_6', '7_10', '11_14');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- KID_PLACE_KINDS (9)
DO $$ BEGIN
  CREATE TYPE kid_place_kind AS ENUM ('playground', 'nature_park', 'family_camp', 'farm', 'easy_trail', 'beach', 'adventure_park', 'museum', 'zoo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------
-- types.ts içinde satır içi birleşim (union) olarak geçen ek tipler
-- --------------------------------------------------------------------

-- Story.mediaType
DO $$ BEGIN
  CREATE TYPE story_media_type AS ENUM ('image', 'video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DestinationStage.connectivity
DO $$ BEGIN
  CREATE TYPE stage_connectivity AS ENUM ('none', 'sat_only', '2g', '4g', 'wifi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UnitBlock.reason
DO $$ BEGIN
  CREATE TYPE unit_block_reason AS ENUM ('booking', 'maintenance', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment.provider
DO $$ BEGIN
  CREATE TYPE payment_provider AS ENUM ('iyzico', 'stripe', 'mock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AmsCheck.severity
DO $$ BEGIN
  CREATE TYPE ams_severity AS ENUM ('none', 'mild', 'moderate', 'severe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Challenge.unit
DO $$ BEGIN
  CREATE TYPE challenge_unit AS ENUM ('km', 'm', 'count');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LibraryPlace.source
DO $$ BEGIN
  CREATE TYPE library_source AS ENUM ('osm', 'wikidata', 'curated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VisionAdvice.source / SpeciesIdentification.source
DO $$ BEGIN
  CREATE TYPE advice_source AS ENUM ('remote', 'local');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Consultation.channel
DO $$ BEGIN
  CREATE TYPE consult_channel AS ENUM ('chat', 'video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NewsItem.severity
DO $$ BEGIN
  CREATE TYPE news_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HeritageSite.accessibility
DO $$ BEGIN
  CREATE TYPE heritage_accessibility AS ENUM ('easy', 'moderate', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Species.activeHours
DO $$ BEGIN
  CREATE TYPE species_active_hours AS ENUM ('day', 'night', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HuntTask.category
DO $$ BEGIN
  CREATE TYPE hunt_task_category AS ENUM ('plant', 'animal', 'rock', 'water', 'sky', 'sound', 'craft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FamilyChecklistItem.category
DO $$ BEGIN
  CREATE TYPE family_checklist_category AS ENUM ('safety', 'comfort', 'food', 'fun', 'health');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MapPack.format
DO $$ BEGIN
  CREATE TYPE map_pack_format AS ENUM ('pmtiles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BillingRepository.subscribe
DO $$ BEGIN
  CREATE TYPE billing_period AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WeatherAlert.kind
DO $$ BEGIN
  CREATE TYPE weather_alert_kind AS ENUM ('wind', 'storm', 'cold', 'heat', 'snow', 'rain', 'uv', 'lightning');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WeatherAlert.level
DO $$ BEGIN
  CREATE TYPE weather_alert_level AS ENUM ('info', 'warning', 'danger');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AvalancheBulletin.source
DO $$ BEGIN
  CREATE TYPE avalanche_source AS ENUM ('eaws', 'mock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
