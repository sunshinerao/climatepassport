import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.channelSessionBridge.deleteMany();
  await prisma.learningExperienceProgramEventLink.deleteMany();
  await prisma.learningExperienceParticipation.deleteMany();
  await prisma.learningExperienceApplication.deleteMany();
  await prisma.learningExperienceStage.deleteMany();
  await prisma.learningExperienceProgram.deleteMany();
  await prisma.learningExperienceCategory.deleteMany();
  await prisma.certificateVerification.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.passportMilestone.deleteMany();
  await prisma.certificateIssue.deleteMany();
  await prisma.certificateDefinition.deleteMany();
  await prisma.certificateTemplate.deleteMany();
  await prisma.certificateCategory.deleteMany();
  await prisma.achievementDefinition.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.pointTransaction.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.eventVerifier.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.agendaItem.deleteMany();
  await prisma.speakerRole.deleteMany();
  await prisma.speaker.deleteMany();
  await prisma.eventDateSlot.deleteMany();
  await prisma.eventInstitution.deleteMany();
  await prisma.invitationRequest.deleteMany();
  await prisma.specialPass.deleteMany();
  await prisma.event.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.track.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
}

async function seedPlatformBaseline() {
  const fellowCreatedAt = new Date("2026-05-01T08:00:00+08:00");
  const adminCreatedAt = new Date("2026-05-03T10:00:00+08:00");
  const managerCreatedAt = new Date("2026-05-04T09:30:00+08:00");
  const verifierCreatedAt = new Date("2026-05-05T09:00:00+08:00");

  const fellow = await prisma.user.create({
    data: {
      email: "lin.qiao@climatepass.org",
      password: "seeded-password",
      name: "Lin Qiao",
      salutation: "Ms.",
      title: "Climate Passport Fellow",
      country: "China",
      role: "ATTENDEE",
      status: "ACTIVE",
      climatePassportId: "AB73Q2M-8T19KX",
      points: 184,
      createdAt: fellowCreatedAt,
      updatedAt: fellowCreatedAt,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "ops.admin@climatepass.org",
      password: "seeded-password",
      name: "Avery Tan",
      salutation: "Mx.",
      title: "Platform Operations Lead",
      country: "Singapore",
      role: "ADMIN",
      status: "ACTIVE",
      points: 40,
      createdAt: adminCreatedAt,
      updatedAt: adminCreatedAt,
    },
  });

  const eventManager = await prisma.user.create({
    data: {
      email: "events.manager@climatepass.org",
      password: "seeded-password",
      name: "Jordan Park",
      salutation: "Mx.",
      title: "Event Manager",
      country: "China",
      role: "EVENT_MANAGER",
      status: "ACTIVE",
      points: 28,
      createdAt: managerCreatedAt,
      updatedAt: managerCreatedAt,
    },
  });

  const verifier = await prisma.user.create({
    data: {
      email: "verifier.field@climatepass.org",
      password: "seeded-password",
      name: "Maya Chen",
      salutation: "Ms.",
      title: "Verifier Captain",
      country: "China",
      role: "VERIFIER",
      status: "ACTIVE",
      points: 72,
      createdAt: verifierCreatedAt,
      updatedAt: verifierCreatedAt,
    },
  });

  const organizationOwner = await prisma.user.create({
    data: {
      email: "partnerships@futurecitylab.org",
      password: "seeded-password",
      name: "Future City Lab",
      title: "Institution Account",
      country: "China",
      role: "ORGANIZATION",
      status: "ACTIVE",
      points: 12,
    },
  });

  await prisma.organization.create({
    data: {
      userId: organizationOwner.id,
      name: "Future City Lab",
      website: "https://futurecitylab.example",
      description: "Seed organization record for Passport platform validation.",
      industry: "Urban Innovation",
      size: "51-200",
      contactName: "Future City Lab Team",
      contactEmail: "partnerships@futurecitylab.org",
    },
  });

  const track = await prisma.track.create({
    data: {
      code: "systems-forum",
      name: "Systems Forum",
      nameEn: "Systems Forum",
      description: "面向制度、城市与系统协同的气候议题主线。",
      descriptionEn: "Climate programming focused on institutions, cities, and systems coordination.",
      category: "forum",
      color: "#0F766E",
      icon: "globe",
      order: 1,
    },
  });

  const institution = await prisma.institution.create({
    data: {
      slug: "future-city-lab",
      name: "未来城市实验室",
      nameEn: "Future City Lab",
      shortName: "未来城市实验室",
      shortNameEn: "FCL",
      website: "https://futurecitylab.example",
      orgType: "Research Institute",
      countryOrRegion: "中国",
      countryOrRegionEn: "China",
      description: "聚焦城市脱碳、系统治理与跨部门协作的研究机构。",
      descriptionEn: "Research institute focused on urban decarbonization, systems governance, and cross-sector coordination.",
      order: 1,
    },
  });

  const eventOne = await prisma.event.create({
    data: {
      title: "气候系统论坛",
      titleEn: "Climate Systems Forum",
      description: "围绕城市、产业与政策协同的核心论坛。",
      descriptionEn: "Core forum focused on cities, industry, and policy coordination.",
      shortDesc: "多边对话与系统治理",
      shortDescEn: "Multilateral dialogue and systems governance",
      startDate: new Date("2026-06-08T09:00:00+08:00"),
      endDate: new Date("2026-06-10T18:00:00+08:00"),
      startTime: "09:00",
      endTime: "18:00",
      venue: "上海世博馆 A 厅",
      venueEn: "Shanghai Expo Hall A",
      address: "上海浦东新区世博大道 1500 号",
      addressEn: "1500 Expo Avenue, Pudong, Shanghai",
      city: "上海",
      cityEn: "Shanghai",
      type: "forum",
      eventLayer: "INSTITUTION",
      hostType: "OFFICIAL",
      trackId: track.id,
      managerUserId: admin.id,
      venueCheckinSecret: "seed-checkin-secret-forum",
      maxAttendees: 500,
      requireApproval: false,
      isClosed: false,
      isPublished: true,
      isFeatured: true,
      isPinned: true,
    },
  });

  const eventTwo = await prisma.event.create({
    data: {
      title: "城市脱碳圆桌",
      titleEn: "Urban Decarbonization Roundtable",
      description: "聚焦城市更新、能源与基础设施协同。",
      descriptionEn: "Focused on urban renewal, energy, and infrastructure coordination.",
      shortDesc: "闭门交流",
      shortDescEn: "Closed-door discussion",
      startDate: new Date("2026-06-11T13:30:00+08:00"),
      endDate: new Date("2026-06-11T17:30:00+08:00"),
      startTime: "13:30",
      endTime: "17:30",
      venue: "外滩可持续之家",
      venueEn: "Bund Sustainability House",
      address: "上海黄浦区中山东一路 18 号",
      addressEn: "18 Zhongshan East 1st Road, Huangpu, Shanghai",
      city: "上海",
      cityEn: "Shanghai",
      type: "roundtable",
      eventLayer: "ECONOMY",
      hostType: "CO_HOSTED",
      trackId: track.id,
      managerUserId: eventManager.id,
      venueCheckinSecret: "seed-checkin-secret-roundtable",
      maxAttendees: 120,
      requireApproval: true,
      isClosed: false,
      isPublished: true,
      isFeatured: false,
      isPinned: false,
    },
  });

  await prisma.eventInstitution.createMany({
    data: [
      {
        eventId: eventOne.id,
        institutionId: institution.id,
        roleLabel: "联合主办",
        roleLabelEn: "Co-host",
        order: 1,
      },
      {
        eventId: eventTwo.id,
        institutionId: institution.id,
        roleLabel: "支持机构",
        roleLabelEn: "Supporting institution",
        order: 1,
      },
    ],
  });

  await prisma.eventDateSlot.createMany({
    data: [
      {
        eventId: eventOne.id,
        scheduleDate: new Date("2026-06-08T00:00:00+08:00"),
        startTime: "09:00",
        endTime: "18:00",
      },
      {
        eventId: eventOne.id,
        scheduleDate: new Date("2026-06-09T00:00:00+08:00"),
        startTime: "09:00",
        endTime: "18:00",
      },
      {
        eventId: eventTwo.id,
        scheduleDate: new Date("2026-06-11T00:00:00+08:00"),
        startTime: "13:30",
        endTime: "17:30",
      },
    ],
  });

  const speaker = await prisma.speaker.create({
    data: {
      slug: "emma-liu",
      salutation: "Dr.",
      name: "刘艾玛",
      nameEn: "Emma Liu",
      title: "系统治理负责人",
      titleEn: "Director of Systems Governance",
      organization: "未来城市实验室",
      organizationEn: "Future City Lab",
      bio: "长期从事城市气候治理与系统设计研究。",
      bioEn: "Works on urban climate governance and systems design.",
      summary: "系统治理与跨部门协作",
      summaryEn: "Systems governance and cross-sector coordination",
      countryOrRegion: "中国",
      countryOrRegionEn: "China",
      institutionId: institution.id,
      isKeynote: true,
      order: 1,
    },
  });

  await prisma.speakerRole.create({
    data: {
      speakerId: speaker.id,
      title: "系统治理负责人",
      titleEn: "Director of Systems Governance",
      organization: "未来城市实验室",
      organizationEn: "Future City Lab",
      startYear: 2023,
      isCurrent: true,
      order: 1,
    },
  });

  await prisma.agendaItem.create({
    data: {
      eventId: eventOne.id,
      agendaDate: new Date("2026-06-08T00:00:00+08:00"),
      startTime: "10:00",
      endTime: "11:00",
      title: "系统治理主旨对话",
      titleEn: "Systems Governance Keynote Dialogue",
      description: "围绕城市与产业协同减排展开主旨讨论。",
      descriptionEn: "Keynote discussion on city and industry collaboration for decarbonization.",
      type: "keynote",
      venue: "主论坛",
      moderatorId: speaker.id,
      order: 1,
      speakers: {
        connect: [{ id: speaker.id }],
      },
    },
  });

  const registrationOne = await prisma.registration.create({
    data: {
      userId: fellow.id,
      eventId: eventOne.id,
      status: "ATTENDED",
      checkedInAt: new Date("2026-06-08T09:14:00+08:00"),
      checkedInBy: verifier.id,
      checkInMethod: "QR_SCAN",
      pointsEarned: 20,
    },
  });

  await prisma.registration.create({
    data: {
      userId: fellow.id,
      eventId: eventTwo.id,
      status: "REGISTERED",
      pointsEarned: 0,
    },
  });

  await prisma.eventVerifier.create({
    data: {
      userId: verifier.id,
      eventId: eventOne.id,
    },
  });

  await prisma.wishlist.create({
    data: {
      userId: fellow.id,
      eventId: eventTwo.id,
    },
  });

  await prisma.checkIn.createMany({
    data: [
      {
        userId: fellow.id,
        eventId: eventOne.id,
        scannedBy: verifier.id,
        scannedAt: new Date("2026-06-08T09:12:00+08:00"),
        method: "passport-qr",
      },
      {
        userId: fellow.id,
        eventId: eventOne.id,
        scannedBy: verifier.id,
        scannedAt: new Date("2026-06-08T09:14:00+08:00"),
        method: "attendance-qr",
      },
      {
        userId: verifier.id,
        eventId: eventTwo.id,
        scannedBy: admin.id,
        scannedAt: new Date("2026-06-11T13:20:00+08:00"),
        method: "staff-scan",
      },
    ],
  });

  await prisma.pointTransaction.createMany({
    data: [
      {
        userId: fellow.id,
        points: 20,
        type: "attendance_reward",
        eventId: eventOne.id,
        registrationId: registrationOne.id,
        description: "Verified attendance reward for Climate Systems Forum",
        createdBy: verifier.id,
      },
      {
        userId: verifier.id,
        points: 12,
        type: "verifier_shift",
        eventId: eventOne.id,
        description: "Verifier shift completion reward",
        createdBy: admin.id,
      },
    ],
  });

  await prisma.invitationRequest.create({
    data: {
      userId: fellow.id,
      guestName: "Diego Sun",
      guestTitle: "Urban Policy Advisor",
      guestOrg: "Civic Climate Lab",
      guestEmail: "diego.sun@example.com",
      language: "en",
      eventId: eventTwo.id,
      purpose: "Invite external advisor to the urban decarbonization roundtable.",
      status: "UPLOADED",
      letterFileUrl: "/seed/invitations/urban-decarbonization-roundtable.pdf",
    },
  });

  await prisma.specialPass.create({
    data: {
      userId: fellow.id,
      entryType: "INTERNATIONAL",
      status: "APPROVED",
      country: "China",
      name: "Lin Qiao",
      birthDate: "1994-10-18",
      gender: "Female",
      docNumber: "P12345678",
      docValidFrom: "2024-01-01",
      docValidTo: "2034-01-01",
      organization: "Future City Lab",
      jobTitle: "Climate Passport Fellow",
      docType: "Passport",
      email: "lin.qiao@climatepass.org",
      phoneArea: "+86",
      phone: "13800000000",
      reviewedBy: admin.id,
      reviewedAt: new Date("2026-05-10T14:00:00+08:00"),
      adminNotes: "Approved for seeded platform validation.",
    },
  });

  await prisma.notificationPreference.createMany({
    data: [
      {
        userId: fellow.id,
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: false,
      },
      {
        userId: eventManager.id,
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: false,
      },
      {
        userId: admin.id,
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: true,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: fellow.id,
        channel: "IN_APP",
        status: "DELIVERED",
        kind: "ATTENDANCE",
        title: "出席已核验",
        titleEn: "Attendance verified",
        body: "你的活动出席记录已经归档到 Climate Passport。",
        bodyEn: "Your event attendance has been archived to Climate Passport.",
        actionUrl: "/dashboard/climate-passport",
        deliveredAt: new Date("2026-06-08T09:16:00+08:00"),
      },
      {
        userId: fellow.id,
        channel: "EMAIL",
        status: "DELIVERED",
        kind: "CERTIFICATE",
        title: "证书已签发",
        titleEn: "Certificate issued",
        body: "新的出席证书已经可供下载与验真。",
        bodyEn: "A new attendance certificate is now available for download and verification.",
        actionUrl: "/certificates",
        deliveredAt: new Date("2026-06-09T10:00:00+08:00"),
      },
      {
        userId: eventManager.id,
        channel: "IN_APP",
        status: "DELIVERED",
        kind: "REGISTRATION",
        title: "活动审批待处理",
        titleEn: "Event approval pending",
        body: "城市脱碳圆桌出现新的待审批报名。",
        bodyEn: "Urban Decarbonization Roundtable has a new registration pending review.",
        actionUrl: "/admin/events",
        deliveredAt: new Date("2026-06-10T09:00:00+08:00"),
      },
      {
        userId: admin.id,
        channel: "IN_APP",
        status: "DELIVERED",
        kind: "SYSTEM",
        title: "管理任务提醒",
        titleEn: "Admin task reminder",
        body: "有新的邀请函与特别通行证申请等待处理。",
        bodyEn: "New invitation and special pass requests are awaiting review.",
        actionUrl: "/admin",
        deliveredAt: new Date("2026-06-10T08:30:00+08:00"),
      },
    ],
  });

  await prisma.contactMessage.createMany({
    data: [
      {
        name: fellow.name,
        email: fellow.email,
        organization: "Climate Passport Fellow",
        userId: fellow.id,
        category: "GENERAL",
        subject: "Invitation letter follow-up",
        message: "Need an updated invitation letter reflecting the revised event date.",
        status: "PENDING",
      },
      {
        name: organizationOwner.name,
        email: organizationOwner.email,
        organization: "Future City Lab",
        userId: organizationOwner.id,
        category: "PARTNERSHIP",
        subject: "Channel integration inquiry",
        message: "We would like to discuss using Climate Passport as the identity layer for a partner program.",
        status: "REPLIED",
        adminReply: "Platform team will share the integration checklist and API access path.",
        repliedAt: new Date("2026-06-12T14:20:00+08:00"),
        repliedBy: admin.id,
      },
    ],
  });

  const achievementAttendance = await prisma.achievementDefinition.create({
    data: {
      key: "verified-participant",
      name: "已验证参与者",
      nameEn: "Verified Participant",
      description: "完成关键活动核验出席。",
      descriptionEn: "Completed verified attendance for a flagship event.",
      pointThreshold: 20,
      order: 1,
    },
  });

  const achievementArchive = await prisma.achievementDefinition.create({
    data: {
      key: "milestone-archivist",
      name: "Milestone 归档者",
      nameEn: "Milestone Archivist",
      description: "学习和活动成果已进入 Passport 长期档案。",
      descriptionEn: "Learning and event outcomes archived into the Passport record.",
      pointThreshold: 40,
      order: 2,
    },
  });

  const attendanceCategory = await prisma.certificateCategory.create({
    data: {
      key: "attendance-certificates",
      name: "出席证书",
      nameEn: "Attendance Certificates",
      description: "完成核验出席并在活动结束后发放。",
      descriptionEn: "Issued after verified attendance completion and event closure.",
      order: 1,
    },
  });

  const learningCategory = await prisma.certificateCategory.create({
    data: {
      key: "learning-milestones",
      name: "学习里程碑证书",
      nameEn: "Learning Milestone Certificates",
      description: "项目完成并经导师审批后发放。",
      descriptionEn: "Issued after program completion and mentor approval.",
      order: 2,
    },
  });

  const attendanceTemplate = await prisma.certificateTemplate.create({
    data: {
      categoryId: attendanceCategory.id,
      name: "标准出席模板",
      nameEn: "Standard Attendance Template",
      templateType: "ATTENDANCE",
      templateConfigJson: {
        orientation: "landscape",
        theme: "climate-passport",
      },
      renderConfigJson: {
        showQr: true,
        showSignature: true,
      },
      version: 1,
    },
  });

  const learningTemplate = await prisma.certificateTemplate.create({
    data: {
      categoryId: learningCategory.id,
      name: "学习成果模板",
      nameEn: "Learning Outcome Template",
      templateType: "LEARNING",
      templateConfigJson: {
        orientation: "portrait",
        theme: "achievement",
      },
      renderConfigJson: {
        showMilestone: true,
      },
      version: 1,
    },
  });

  const attendanceDefinition = await prisma.certificateDefinition.create({
    data: {
      categoryId: attendanceCategory.id,
      templateId: attendanceTemplate.id,
      achievementDefinitionId: achievementAttendance.id,
      name: "上海气候周核验出席证书",
      nameEn: "Shanghai Climate Week Verified Attendance",
      issueRule: {
        sourceType: "event-attendance",
        requiresVerifiedAttendance: true,
      },
      approvalMode: "auto",
      verificationMode: "PUBLIC_CODE",
      pointReward: 10,
      milestoneTitleTemplate: "已完成关键活动出席核验",
      milestoneTitleTemplateEn: "Completed verified flagship event attendance",
      isActive: true,
    },
  });

  const learningDefinition = await prisma.certificateDefinition.create({
    data: {
      categoryId: learningCategory.id,
      templateId: learningTemplate.id,
      achievementDefinitionId: achievementArchive.id,
      name: "气候创新 Sprint 完成证书",
      nameEn: "Climate Innovation Sprint Completion",
      issueRule: {
        sourceType: "learning-experience",
        requiresApproval: true,
      },
      approvalMode: "manual",
      verificationMode: "QR_CODE",
      pointReward: 20,
      milestoneTitleTemplate: "学习里程碑已归档",
      milestoneTitleTemplateEn: "Learning milestone archived",
      isActive: true,
    },
  });

  const issuedAttendanceCertificate = await prisma.certificateIssue.create({
    data: {
      definitionId: attendanceDefinition.id,
      userId: fellow.id,
      sourceType: "registration",
      sourceId: registrationOne.id,
      status: "ISSUED",
      generatedFileUrl: "/seed/certificates/attendance-certificate.pdf",
      generatedFileName: "attendance-certificate.pdf",
      verificationCode: "CP-CERT-2026-00384",
      approvedBy: admin.id,
      approvedAt: new Date("2026-06-08T20:00:00+08:00"),
      issuedAt: new Date("2026-06-08T20:05:00+08:00"),
      downloadCount: 3,
      pointsAwarded: 10,
    },
  });

  const issuedLearningCertificate = await prisma.certificateIssue.create({
    data: {
      definitionId: learningDefinition.id,
      userId: fellow.id,
      sourceType: "learning-experience",
      sourceId: "seed-learning-experience-001",
      status: "ISSUED",
      generatedFileUrl: "/seed/certificates/learning-certificate.pdf",
      generatedFileName: "learning-certificate.pdf",
      verificationCode: "CP-CERT-2026-00421",
      approvedBy: admin.id,
      approvedAt: new Date("2026-06-12T19:00:00+08:00"),
      issuedAt: new Date("2026-06-12T19:30:00+08:00"),
      downloadCount: 1,
      pointsAwarded: 20,
    },
  });

  await prisma.userAchievement.createMany({
    data: [
      {
        userId: fellow.id,
        achievementDefinitionId: achievementAttendance.id,
        sourceType: "certificate",
        sourceId: issuedAttendanceCertificate.id,
        certificateIssueId: issuedAttendanceCertificate.id,
        unlockedAt: new Date("2026-06-08T20:05:00+08:00"),
      },
      {
        userId: fellow.id,
        achievementDefinitionId: achievementArchive.id,
        sourceType: "certificate",
        sourceId: issuedLearningCertificate.id,
        certificateIssueId: issuedLearningCertificate.id,
        unlockedAt: new Date("2026-06-12T19:30:00+08:00"),
      },
    ],
  });

  await prisma.passportMilestone.createMany({
    data: [
      {
        userId: fellow.id,
        title: "关键活动核验已完成",
        titleEn: "Verified flagship event attendance completed",
        description: "气候系统论坛的现场核验与积分回写已完成。",
        descriptionEn: "On-site attendance verification and points writeback for Climate Systems Forum completed.",
        sourceType: "event",
        sourceId: eventOne.id,
        eventId: eventOne.id,
        certificateIssueId: issuedAttendanceCertificate.id,
      },
      {
        userId: fellow.id,
        title: "学习里程碑已归档",
        titleEn: "Learning milestone archived",
        description: "学习成果证书已签发并纳入 Passport 档案。",
        descriptionEn: "Learning completion certificate issued and archived into Passport history.",
        sourceType: "learning-experience",
        sourceId: "seed-learning-experience-001",
        certificateIssueId: issuedLearningCertificate.id,
      },
    ],
  });

  await prisma.certificateVerification.createMany({
    data: [
      {
        certificateIssueId: issuedAttendanceCertificate.id,
        verifiedAt: new Date("2026-06-09T09:00:00+08:00"),
        verifiedBy: verifier.id,
        verificationChannel: "public-code",
        result: "VALID",
        metadataJson: {
          entry: "public verification portal",
        },
      },
      {
        certificateIssueId: issuedLearningCertificate.id,
        verifiedAt: new Date("2026-06-13T10:15:00+08:00"),
        verifiedBy: admin.id,
        verificationChannel: "qr-code",
        result: "VALID",
        metadataJson: {
          entry: "passport dashboard",
        },
      },
    ],
  });

  const summerSchoolCategory = await prisma.learningExperienceCategory.create({
    data: {
      slug: "summer-school",
      name: "暑期学校",
      nameEn: "Summer School",
      description: "面向青年与跨学科实践者的系统性学习项目。",
      descriptionEn: "System-oriented cohort programs for youth and cross-disciplinary practitioners.",
      order: 1,
    },
  });

  const fellowshipCategory = await prisma.learningExperienceCategory.create({
    data: {
      slug: "fellowship",
      name: "研究员项目",
      nameEn: "Fellowship",
      description: "围绕城市与气候治理议题的研究员周期项目。",
      descriptionEn: "Cohort fellowships focused on city and climate governance themes.",
      order: 2,
    },
  });

  const summerSchoolProgram = await prisma.learningExperienceProgram.create({
    data: {
      slug: "gca-yungu-summer-school-2026",
      categoryId: summerSchoolCategory.id,
      managerUserId: eventManager.id,
      certificateDefinitionId: learningDefinition.id,
      title: "GCA 云谷暑期学校 2026",
      titleEn: "GCA Yungu Summer School 2026",
      summary: "聚焦系统思维、行为科学与 AI 协作的暑期项目。",
      summaryEn: "Summer program focused on systems thinking, behavioral science, and AI collaboration.",
      location: "上海",
      locationEn: "Shanghai",
      applicationOpenAt: new Date("2026-05-20T09:00:00+08:00"),
      applicationCloseAt: new Date("2026-06-15T23:59:00+08:00"),
      cohortStartAt: new Date("2026-07-20T09:00:00+08:00"),
      cohortEndAt: new Date("2026-08-12T18:00:00+08:00"),
      capacity: 120,
      pointReward: 30,
      status: "PUBLISHED",
      isPublished: true,
      applicationSchemaJson: {
        requiredFields: ["motivation", "projectIdea"],
      },
    },
  });

  await prisma.learningExperienceProgram.create({
    data: {
      slug: "climate-governance-fellowship-2026",
      categoryId: fellowshipCategory.id,
      managerUserId: admin.id,
      title: "气候治理研究员计划 2026",
      titleEn: "Climate Governance Fellowship 2026",
      summary: "针对跨部门治理协同能力的长期 cohort。",
      summaryEn: "Long-running cohort for cross-sector governance collaboration.",
      location: "Hybrid",
      locationEn: "Hybrid",
      applicationOpenAt: new Date("2026-05-25T09:00:00+08:00"),
      applicationCloseAt: new Date("2026-07-01T23:59:00+08:00"),
      capacity: 40,
      pointReward: 60,
      status: "DRAFT",
      isPublished: false,
    },
  });

  const stageApplied = await prisma.learningExperienceStage.create({
    data: {
      programId: summerSchoolProgram.id,
      key: "submitted",
      name: "已提交",
      nameEn: "Submitted",
      order: 1,
    },
  });

  await prisma.learningExperienceStage.createMany({
    data: [
      {
        programId: summerSchoolProgram.id,
        key: "interview",
        name: "面试",
        nameEn: "Interview",
        order: 2,
      },
      {
        programId: summerSchoolProgram.id,
        key: "admitted",
        name: "录取",
        nameEn: "Admitted",
        order: 3,
        isDecisionStage: true,
      },
    ],
  });

  const learningApplication = await prisma.learningExperienceApplication.create({
    data: {
      programId: summerSchoolProgram.id,
      userId: fellow.id,
      currentStageId: stageApplied.id,
      status: "SUBMITTED",
      answersJson: {
        motivation: "Build a climate AI project with policy impact.",
      },
      submittedAt: new Date("2026-05-21T11:00:00+08:00"),
    },
  });

  await prisma.learningExperienceParticipation.create({
    data: {
      programId: summerSchoolProgram.id,
      userId: fellow.id,
      applicationId: learningApplication.id,
      certificateIssueId: issuedLearningCertificate.id,
      status: "ACTIVE",
      completionPercent: 45,
      mentorReviewJson: {
        summary: "Strong systems framing and execution discipline.",
      },
      pointsAwarded: 20,
      startedAt: new Date("2026-07-20T09:00:00+08:00"),
    },
  });

  await prisma.learningExperienceProgramEventLink.createMany({
    data: [
      {
        programId: summerSchoolProgram.id,
        eventId: eventOne.id,
        linkType: "OPENING",
        title: "开营大会",
        titleEn: "Opening Ceremony",
        order: 1,
      },
      {
        programId: summerSchoolProgram.id,
        eventId: eventTwo.id,
        linkType: "DEMO_DAY",
        title: "成果展示日",
        titleEn: "Demo Day",
        order: 2,
      },
    ],
  });

  return {
    users: 5,
    events: 2,
    certificates: 2,
    learningPrograms: 2,
    learningApplications: 1,
    notificationPreferences: 3,
    notifications: 4,
    contactMessages: 2,
  };
}

async function main() {
  await resetDatabase();
  const counts = await seedPlatformBaseline();

  console.log("Climate Passport seed complete");
  console.log(`Users: ${counts.users}`);
  console.log(`Events: ${counts.events}`);
  console.log(`Issued certificates: ${counts.certificates}`);
  console.log(`Learning programs: ${counts.learningPrograms}`);
  console.log(`Learning applications: ${counts.learningApplications}`);
  console.log(`Notification preferences: ${counts.notificationPreferences}`);
  console.log(`Notifications: ${counts.notifications}`);
  console.log(`Contact messages: ${counts.contactMessages}`);
}

main()
  .catch((error) => {
    console.error("Climate Passport seed failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });