#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const targetDatabaseUrl = process.env.CLIMATE_PASSPORT_DATABASE_URL ?? process.env.DATABASE_URL;

if (targetDatabaseUrl) {
  process.env.DATABASE_URL = targetDatabaseUrl;
}

const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const inputDirArgIndex = args.findIndex((arg) => arg === "--input-dir");
const inputDir =
  inputDirArgIndex >= 0 && args[inputDirArgIndex + 1]
    ? args[inputDirArgIndex + 1]
    : "artifacts/shcw-core-extract";

async function readJsonArtifact(name) {
  const filePath = path.join(process.cwd(), inputDir, `${name}.json`);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function toDate(value) {
  return value ? new Date(value) : null;
}

async function upsertTracks(tracks) {
  for (const track of tracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: {
        code: track.code,
        name: track.name,
        nameEn: track.nameEn,
        description: track.description,
        descriptionEn: track.descriptionEn,
        category: track.category,
        color: track.color,
        icon: track.icon,
        partners: track.partners,
        partnersEn: track.partnersEn,
        order: track.order,
        createdAt: toDate(track.createdAt) ?? undefined,
        updatedAt: toDate(track.updatedAt) ?? undefined,
      },
      create: {
        id: track.id,
        code: track.code,
        name: track.name,
        nameEn: track.nameEn,
        description: track.description,
        descriptionEn: track.descriptionEn,
        category: track.category,
        color: track.color,
        icon: track.icon,
        partners: track.partners,
        partnersEn: track.partnersEn,
        order: track.order,
        createdAt: toDate(track.createdAt) ?? undefined,
        updatedAt: toDate(track.updatedAt) ?? undefined,
      },
    });
  }
}

async function upsertUsers(users) {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        password: user.password,
        name: user.name,
        salutation: user.salutation,
        avatar: user.avatar,
        phone: user.phone,
        title: user.title,
        bio: user.bio,
        country: user.country,
        role: user.role,
        status: user.status,
        staffPermissions: Array.isArray(user.staffPermissions)
          ? JSON.stringify(user.staffPermissions)
          : user.staffPermissions,
        passCode: user.passCode,
        climatePassportId: user.climatePassportId,
        points: user.points,
        emailVerified: toDate(user.emailVerified) ?? undefined,
        resetToken: user.resetToken,
        resetTokenExpiry: toDate(user.resetTokenExpiry) ?? undefined,
        createdAt: toDate(user.createdAt) ?? undefined,
        updatedAt: toDate(user.updatedAt) ?? undefined,
      },
      create: {
        id: user.id,
        email: user.email,
        password: user.password,
        name: user.name,
        salutation: user.salutation,
        avatar: user.avatar,
        phone: user.phone,
        title: user.title,
        bio: user.bio,
        country: user.country,
        role: user.role,
        status: user.status,
        staffPermissions: Array.isArray(user.staffPermissions)
          ? JSON.stringify(user.staffPermissions)
          : user.staffPermissions,
        passCode: user.passCode,
        climatePassportId: user.climatePassportId,
        points: user.points,
        emailVerified: toDate(user.emailVerified) ?? undefined,
        resetToken: user.resetToken,
        resetTokenExpiry: toDate(user.resetTokenExpiry) ?? undefined,
        createdAt: toDate(user.createdAt) ?? undefined,
        updatedAt: toDate(user.updatedAt) ?? undefined,
      },
    });
  }
}

async function upsertEvents(events) {
  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        title: event.title,
        titleEn: event.titleEn,
        description: event.description,
        descriptionEn: event.descriptionEn,
        shortDesc: event.shortDesc,
        shortDescEn: event.shortDescEn,
        highlights: event.highlights,
        highlightsEn: event.highlightsEn,
        highlightsGeneratedAt: toDate(event.highlightsGeneratedAt) ?? undefined,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        startTime: event.startTime,
        endTime: event.endTime,
        venue: event.venue,
        venueEn: event.venueEn,
        address: event.address,
        addressEn: event.addressEn,
        city: event.city,
        cityEn: event.cityEn,
        image: event.image,
        partners: event.partners,
        partnersEn: event.partnersEn,
        type: event.type,
        eventLayer: event.eventLayer,
        hostType: event.hostType,
        trackId: event.trackId,
        managerUserId: event.managerUserId,
        venueCheckinSecret: event.venueCheckinSecret,
        invitationContentHtml_zh: event.invitationContentHtmlZh,
        invitationContentHtml_en: event.invitationContentHtmlEn,
        maxAttendees: event.maxAttendees,
        requireApproval: event.requireApproval,
        isClosed: event.isClosed,
        isPublished: event.isPublished,
        isFeatured: event.isFeatured,
        isPinned: event.isPinned,
        createdAt: toDate(event.createdAt) ?? undefined,
        updatedAt: toDate(event.updatedAt) ?? undefined,
      },
      create: {
        id: event.id,
        title: event.title,
        titleEn: event.titleEn,
        description: event.description,
        descriptionEn: event.descriptionEn,
        shortDesc: event.shortDesc,
        shortDescEn: event.shortDescEn,
        highlights: event.highlights,
        highlightsEn: event.highlightsEn,
        highlightsGeneratedAt: toDate(event.highlightsGeneratedAt) ?? undefined,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        startTime: event.startTime,
        endTime: event.endTime,
        venue: event.venue,
        venueEn: event.venueEn,
        address: event.address,
        addressEn: event.addressEn,
        city: event.city,
        cityEn: event.cityEn,
        image: event.image,
        partners: event.partners,
        partnersEn: event.partnersEn,
        type: event.type,
        eventLayer: event.eventLayer,
        hostType: event.hostType,
        trackId: event.trackId,
        managerUserId: event.managerUserId,
        venueCheckinSecret: event.venueCheckinSecret,
        invitationContentHtml_zh: event.invitationContentHtmlZh,
        invitationContentHtml_en: event.invitationContentHtmlEn,
        maxAttendees: event.maxAttendees,
        requireApproval: event.requireApproval,
        isClosed: event.isClosed,
        isPublished: event.isPublished,
        isFeatured: event.isFeatured,
        isPinned: event.isPinned,
        createdAt: toDate(event.createdAt) ?? undefined,
        updatedAt: toDate(event.updatedAt) ?? undefined,
      },
    });

    for (const slot of event.eventDateSlots ?? []) {
      await prisma.eventDateSlot.upsert({
        where: { id: slot.id },
        update: {
          eventId: event.id,
          scheduleDate: new Date(slot.scheduleDate),
          startTime: slot.startTime,
          endTime: slot.endTime,
          createdAt: toDate(slot.createdAt) ?? undefined,
          updatedAt: toDate(slot.updatedAt) ?? undefined,
        },
        create: {
          id: slot.id,
          eventId: event.id,
          scheduleDate: new Date(slot.scheduleDate),
          startTime: slot.startTime,
          endTime: slot.endTime,
          createdAt: toDate(slot.createdAt) ?? undefined,
          updatedAt: toDate(slot.updatedAt) ?? undefined,
        },
      });
    }
  }
}

async function upsertInstitutions(institutions) {
  for (const institution of institutions) {
    await prisma.institution.upsert({
      where: { id: institution.id },
      update: {
        slug: institution.slug,
        name: institution.name,
        nameEn: institution.nameEn,
        shortName: institution.shortName,
        shortNameEn: institution.shortNameEn,
        logo: institution.logo,
        website: institution.website,
        orgType: institution.orgType,
        countryOrRegion: institution.countryOrRegion,
        countryOrRegionEn: institution.countryOrRegionEn,
        description: institution.description,
        descriptionEn: institution.descriptionEn,
        isActive: institution.isActive,
        order: institution.order,
        createdAt: toDate(institution.createdAt) ?? undefined,
        updatedAt: toDate(institution.updatedAt) ?? undefined,
      },
      create: {
        id: institution.id,
        slug: institution.slug,
        name: institution.name,
        nameEn: institution.nameEn,
        shortName: institution.shortName,
        shortNameEn: institution.shortNameEn,
        logo: institution.logo,
        website: institution.website,
        orgType: institution.orgType,
        countryOrRegion: institution.countryOrRegion,
        countryOrRegionEn: institution.countryOrRegionEn,
        description: institution.description,
        descriptionEn: institution.descriptionEn,
        isActive: institution.isActive,
        order: institution.order,
        createdAt: toDate(institution.createdAt) ?? undefined,
        updatedAt: toDate(institution.updatedAt) ?? undefined,
      },
    });
  }
}

async function upsertEventInstitutions(eventInstitutions) {
  for (const eventInstitution of eventInstitutions) {
    await prisma.eventInstitution.upsert({
      where: {
        eventId_institutionId: {
          eventId: eventInstitution.eventId,
          institutionId: eventInstitution.institutionId,
        },
      },
      update: {
        roleLabel: eventInstitution.role,
        roleLabelEn: null,
        showLogo: true,
        order: eventInstitution.order,
      },
      create: {
        eventId: eventInstitution.eventId,
        institutionId: eventInstitution.institutionId,
        roleLabel: eventInstitution.role,
        roleLabelEn: null,
        showLogo: true,
        order: eventInstitution.order,
      },
    });
  }
}

async function upsertSpeakers(speakers) {
  for (const speaker of speakers) {
    await prisma.speaker.upsert({
      where: { id: speaker.id },
      update: {
        slug: speaker.slug,
        salutation: speaker.salutation,
        name: speaker.name,
        nameEn: speaker.nameEn,
        avatar: speaker.avatar,
        title: speaker.title,
        titleEn: speaker.titleEn,
        organization: speaker.organization,
        organizationEn: speaker.organizationEn,
        organizationLogo: speaker.organizationLogo,
        bio: speaker.bio,
        bioEn: speaker.bioEn,
        summary: speaker.summary,
        summaryEn: speaker.summaryEn,
        countryOrRegion: speaker.countryOrRegion,
        countryOrRegionEn: speaker.countryOrRegionEn,
        relevanceToShcw: speaker.relevanceToShcw,
        relevanceToShcwEn: speaker.relevanceToShcwEn,
        expertiseTags: speaker.expertiseTags,
        email: speaker.email,
        linkedin: speaker.linkedin,
        twitter: speaker.twitter,
        website: speaker.website,
        isKeynote: speaker.isKeynote,
        isVisible: speaker.isVisible,
        agendaRoleDisplayMode: speaker.agendaRoleDisplayMode,
        institutionId: speaker.institutionId,
        order: speaker.order,
        createdAt: toDate(speaker.createdAt) ?? undefined,
        updatedAt: toDate(speaker.updatedAt) ?? undefined,
      },
      create: {
        id: speaker.id,
        slug: speaker.slug,
        salutation: speaker.salutation,
        name: speaker.name,
        nameEn: speaker.nameEn,
        avatar: speaker.avatar,
        title: speaker.title,
        titleEn: speaker.titleEn,
        organization: speaker.organization,
        organizationEn: speaker.organizationEn,
        organizationLogo: speaker.organizationLogo,
        bio: speaker.bio,
        bioEn: speaker.bioEn,
        summary: speaker.summary,
        summaryEn: speaker.summaryEn,
        countryOrRegion: speaker.countryOrRegion,
        countryOrRegionEn: speaker.countryOrRegionEn,
        relevanceToShcw: speaker.relevanceToShcw,
        relevanceToShcwEn: speaker.relevanceToShcwEn,
        expertiseTags: speaker.expertiseTags,
        email: speaker.email,
        linkedin: speaker.linkedin,
        twitter: speaker.twitter,
        website: speaker.website,
        isKeynote: speaker.isKeynote,
        isVisible: speaker.isVisible,
        agendaRoleDisplayMode: speaker.agendaRoleDisplayMode,
        institutionId: speaker.institutionId,
        order: speaker.order,
        createdAt: toDate(speaker.createdAt) ?? undefined,
        updatedAt: toDate(speaker.updatedAt) ?? undefined,
      },
    });
  }
}

async function upsertSpeakerRoles(speakerRoles) {
  for (const role of speakerRoles) {
    await prisma.speakerRole.upsert({
      where: { id: role.id },
      update: {
        speakerId: role.speakerId,
        title: role.title,
        titleEn: role.titleEn,
        organization: role.organization,
        organizationEn: role.organizationEn,
        startYear: role.startYear,
        endYear: role.endYear,
        isCurrent: role.isCurrent,
        order: role.order,
        createdAt: toDate(role.createdAt) ?? undefined,
        updatedAt: toDate(role.updatedAt) ?? undefined,
      },
      create: {
        id: role.id,
        speakerId: role.speakerId,
        title: role.title,
        titleEn: role.titleEn,
        organization: role.organization,
        organizationEn: role.organizationEn,
        startYear: role.startYear,
        endYear: role.endYear,
        isCurrent: role.isCurrent,
        order: role.order,
        createdAt: toDate(role.createdAt) ?? undefined,
        updatedAt: toDate(role.updatedAt) ?? undefined,
      },
    });
  }
}

async function upsertAgendaItems(agendaItems) {
  for (const agendaItem of agendaItems) {
    const speakerConnections = (agendaItem.speakerIds ?? []).map((speakerId) => ({ id: speakerId }));

    await prisma.agendaItem.upsert({
      where: { id: agendaItem.id },
      update: {
        eventId: agendaItem.eventId,
        agendaDate: new Date(agendaItem.agendaDate),
        startTime: agendaItem.startTime,
        endTime: agendaItem.endTime,
        title: agendaItem.title,
        titleEn: agendaItem.titleEn,
        description: agendaItem.description,
        descriptionEn: agendaItem.descriptionEn,
        type: agendaItem.type,
        venue: agendaItem.venue,
        speakerMeta: agendaItem.speakerMeta,
        moderatorId: agendaItem.moderatorId,
        order: agendaItem.order,
        createdAt: toDate(agendaItem.createdAt) ?? undefined,
        updatedAt: toDate(agendaItem.updatedAt) ?? undefined,
        speakers: {
          set: speakerConnections,
        },
      },
      create: {
        id: agendaItem.id,
        eventId: agendaItem.eventId,
        agendaDate: new Date(agendaItem.agendaDate),
        startTime: agendaItem.startTime,
        endTime: agendaItem.endTime,
        title: agendaItem.title,
        titleEn: agendaItem.titleEn,
        description: agendaItem.description,
        descriptionEn: agendaItem.descriptionEn,
        type: agendaItem.type,
        venue: agendaItem.venue,
        speakerMeta: agendaItem.speakerMeta,
        moderatorId: agendaItem.moderatorId,
        order: agendaItem.order,
        createdAt: toDate(agendaItem.createdAt) ?? undefined,
        updatedAt: toDate(agendaItem.updatedAt) ?? undefined,
        speakers: {
          connect: speakerConnections,
        },
      },
    });
  }
}

async function upsertRegistrations(registrations) {
  for (const registration of registrations) {
    await prisma.registration.upsert({
      where: { id: registration.id },
      update: {
        userId: registration.userId,
        eventId: registration.eventId,
        status: registration.status,
        notes: registration.notes,
        dietaryReq: registration.dietaryReq,
        checkedInAt: toDate(registration.checkedInAt) ?? undefined,
        checkedInBy: registration.checkedInBy,
        checkInMethod: registration.checkInMethod,
        pointsEarned: registration.pointsEarned,
        createdAt: toDate(registration.createdAt) ?? undefined,
        updatedAt: toDate(registration.updatedAt) ?? undefined,
      },
      create: {
        id: registration.id,
        userId: registration.userId,
        eventId: registration.eventId,
        status: registration.status,
        notes: registration.notes,
        dietaryReq: registration.dietaryReq,
        checkedInAt: toDate(registration.checkedInAt) ?? undefined,
        checkedInBy: registration.checkedInBy,
        checkInMethod: registration.checkInMethod,
        pointsEarned: registration.pointsEarned,
        createdAt: toDate(registration.createdAt) ?? undefined,
        updatedAt: toDate(registration.updatedAt) ?? undefined,
      },
    });
  }
}

async function upsertEventVerifiers(eventVerifiers) {
  for (const assignment of eventVerifiers) {
    await prisma.eventVerifier.upsert({
      where: { id: assignment.id },
      update: {
        userId: assignment.userId,
        eventId: assignment.eventId,
        createdAt: toDate(assignment.createdAt) ?? undefined,
      },
      create: {
        id: assignment.id,
        userId: assignment.userId,
        eventId: assignment.eventId,
        createdAt: toDate(assignment.createdAt) ?? undefined,
      },
    });
  }
}

async function upsertCheckins(checkins) {
  for (const checkin of checkins) {
    await prisma.checkIn.upsert({
      where: { id: checkin.id },
      update: {
        userId: checkin.userId,
        eventId: checkin.eventId,
        scannedBy: checkin.scannedBy,
        scannedAt: toDate(checkin.scannedAt) ?? undefined,
        method: checkin.method,
        createdAt: toDate(checkin.createdAt) ?? undefined,
      },
      create: {
        id: checkin.id,
        userId: checkin.userId,
        eventId: checkin.eventId,
        scannedBy: checkin.scannedBy,
        scannedAt: toDate(checkin.scannedAt) ?? undefined,
        method: checkin.method,
        createdAt: toDate(checkin.createdAt) ?? undefined,
      },
    });
  }
}

async function upsertPointTransactions(pointTransactions) {
  for (const transaction of pointTransactions) {
    await prisma.pointTransaction.upsert({
      where: { id: transaction.id },
      update: {
        userId: transaction.userId,
        points: transaction.points,
        type: transaction.type,
        eventId: transaction.eventId,
        registrationId: transaction.registrationId,
        description: transaction.description,
        createdBy: transaction.createdBy,
        createdAt: toDate(transaction.createdAt) ?? undefined,
      },
      create: {
        id: transaction.id,
        userId: transaction.userId,
        points: transaction.points,
        type: transaction.type,
        eventId: transaction.eventId,
        registrationId: transaction.registrationId,
        description: transaction.description,
        createdBy: transaction.createdBy,
        createdAt: toDate(transaction.createdAt) ?? undefined,
      },
    });
  }
}

async function upsertInvitationRequests(invitationRequests) {
  for (const request of invitationRequests) {
    await prisma.invitationRequest.upsert({
      where: { id: request.id },
      update: {
        userId: request.userId,
        salutation: request.salutation,
        guestName: request.guestName,
        guestTitle: request.guestTitle,
        guestOrg: request.guestOrg,
        guestEmail: request.guestEmail,
        language: request.language,
        eventId: request.eventId,
        purpose: request.purpose,
        notes: request.notes,
        customMainContent: request.customMainContent,
        aiEnhancedBodyZh: request.aiEnhancedBodyZh,
        aiEnhancedBodyEn: request.aiEnhancedBodyEn,
        signaturePresetId: request.signaturePresetId,
        useStamp: request.useStamp,
        status: request.status,
        letterFileUrl: request.letterFileUrl,
        rejectReason: request.rejectReason,
        createdAt: toDate(request.createdAt) ?? undefined,
        updatedAt: toDate(request.updatedAt) ?? undefined,
      },
      create: {
        id: request.id,
        userId: request.userId,
        salutation: request.salutation,
        guestName: request.guestName,
        guestTitle: request.guestTitle,
        guestOrg: request.guestOrg,
        guestEmail: request.guestEmail,
        language: request.language,
        eventId: request.eventId,
        purpose: request.purpose,
        notes: request.notes,
        customMainContent: request.customMainContent,
        aiEnhancedBodyZh: request.aiEnhancedBodyZh,
        aiEnhancedBodyEn: request.aiEnhancedBodyEn,
        signaturePresetId: request.signaturePresetId,
        useStamp: request.useStamp,
        status: request.status,
        letterFileUrl: request.letterFileUrl,
        rejectReason: request.rejectReason,
        createdAt: toDate(request.createdAt) ?? undefined,
        updatedAt: toDate(request.updatedAt) ?? undefined,
      },
    });
  }
}

async function upsertSpecialPasses(specialPasses) {
  for (const specialPass of specialPasses) {
    await prisma.specialPass.upsert({
      where: { id: specialPass.id },
      update: {
        userId: specialPass.userId,
        entryType: specialPass.entryType,
        status: specialPass.status,
        country: specialPass.country,
        name: specialPass.name,
        birthDate: specialPass.birthDate,
        gender: specialPass.gender,
        docNumber: specialPass.docNumber,
        docValidFrom: specialPass.docValidFrom,
        docValidTo: specialPass.docValidTo,
        docPhoto: specialPass.docPhoto,
        docPhotoBack: specialPass.docPhotoBack,
        photo: specialPass.photo,
        organization: specialPass.organization,
        jobTitle: specialPass.jobTitle,
        docType: specialPass.docType,
        email: specialPass.email,
        phoneArea: specialPass.phoneArea,
        phone: specialPass.phone,
        contactMethod: specialPass.contactMethod,
        contactValue: specialPass.contactValue,
        adminNotes: specialPass.adminNotes,
        reviewedBy: specialPass.reviewedBy,
        reviewedAt: toDate(specialPass.reviewedAt) ?? undefined,
        createdAt: toDate(specialPass.createdAt) ?? undefined,
        updatedAt: toDate(specialPass.updatedAt) ?? undefined,
      },
      create: {
        id: specialPass.id,
        userId: specialPass.userId,
        entryType: specialPass.entryType,
        status: specialPass.status,
        country: specialPass.country,
        name: specialPass.name,
        birthDate: specialPass.birthDate,
        gender: specialPass.gender,
        docNumber: specialPass.docNumber,
        docValidFrom: specialPass.docValidFrom,
        docValidTo: specialPass.docValidTo,
        docPhoto: specialPass.docPhoto,
        docPhotoBack: specialPass.docPhotoBack,
        photo: specialPass.photo,
        organization: specialPass.organization,
        jobTitle: specialPass.jobTitle,
        docType: specialPass.docType,
        email: specialPass.email,
        phoneArea: specialPass.phoneArea,
        phone: specialPass.phone,
        contactMethod: specialPass.contactMethod,
        contactValue: specialPass.contactValue,
        adminNotes: specialPass.adminNotes,
        reviewedBy: specialPass.reviewedBy,
        reviewedAt: toDate(specialPass.reviewedAt) ?? undefined,
        createdAt: toDate(specialPass.createdAt) ?? undefined,
        updatedAt: toDate(specialPass.updatedAt) ?? undefined,
      },
    });
  }
}

async function main() {
  if (!targetDatabaseUrl) {
    console.error("Missing required environment variable: CLIMATE_PASSPORT_DATABASE_URL or DATABASE_URL");
    process.exit(1);
  }

  const [tracks, users, events, institutions, eventInstitutions, speakers, speakerRoles, agendaItems, registrations, eventVerifiers, checkins, pointTransactions, invitationRequests, specialPasses] = await Promise.all([
    readJsonArtifact("tracks"),
    readJsonArtifact("users"),
    readJsonArtifact("events"),
    readJsonArtifact("institutions"),
    readJsonArtifact("event-institutions"),
    readJsonArtifact("speakers"),
    readJsonArtifact("speaker-roles"),
    readJsonArtifact("agenda-items"),
    readJsonArtifact("registrations"),
    readJsonArtifact("event-verifiers"),
    readJsonArtifact("checkins"),
    readJsonArtifact("point-transactions"),
    readJsonArtifact("invitation-requests"),
    readJsonArtifact("special-passes"),
  ]);

  await upsertTracks(tracks);
  await upsertUsers(users);
  await upsertEvents(events);
  await upsertInstitutions(institutions);
  await upsertEventInstitutions(eventInstitutions);
  await upsertSpeakers(speakers);
  await upsertSpeakerRoles(speakerRoles);
  await upsertAgendaItems(agendaItems);
  await upsertRegistrations(registrations);
  await upsertEventVerifiers(eventVerifiers);
  await upsertCheckins(checkins);
  await upsertPointTransactions(pointTransactions);
  await upsertInvitationRequests(invitationRequests);
  await upsertSpecialPasses(specialPasses);

  console.log("Climate Passport import complete");
  console.log(`Tracks: ${tracks.length}`);
  console.log(`Users: ${users.length}`);
  console.log(`Events: ${events.length}`);
  console.log(`Institutions: ${institutions.length}`);
  console.log(`Event institutions: ${eventInstitutions.length}`);
  console.log(`Speakers: ${speakers.length}`);
  console.log(`Speaker roles: ${speakerRoles.length}`);
  console.log(`Agenda items: ${agendaItems.length}`);
  console.log(`Registrations: ${registrations.length}`);
  console.log(`Event verifiers: ${eventVerifiers.length}`);
  console.log(`Checkins: ${checkins.length}`);
  console.log(`Point transactions: ${pointTransactions.length}`);
  console.log(`Invitation requests: ${invitationRequests.length}`);
  console.log(`Special passes: ${specialPasses.length}`);
}

main()
  .catch((error) => {
    console.error("Climate Passport import failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });