CREATE TABLE `authenticators` (
	`credentialId` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`credentialPublicKey` text NOT NULL,
	`counter` blob NOT NULL,
	`credentialDeviceType` text(32) NOT NULL,
	`credentialBackedUp` integer NOT NULL,
	`transports` text(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE users ADD `username` text(20) DEFAULT '' NOT NULL;