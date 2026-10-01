import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, optionalAuthenticate, requireRole } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { University } from '../../models/University.js';
import { Campus } from '../../models/Campus.js';
import { Department } from '../../models/Department.js';
import { Course } from '../../models/Course.js';
import { Subject } from '../../models/Subject.js';
import { AppError } from '../../utils/AppError.js';
import { resolveTenant } from '../../middleware/tenant.js';

const router = Router();

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// All taxonomy lists are tenant-scoped via resolveTenant + tenantPlugin

router.get(
  '/universities',
  resolveTenant,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    if (req.tenant?.legacyUniversityId) {
      filter._id = req.tenant.legacyUniversityId;
    } else if (req.tenant?.slug) {
      filter.slug = req.tenant.slug;
    }
    const universities = await University.find(filter).sort({ name: 1 }).lean();
    return sendSuccess(res, {
      data: {
        items: universities.map((u) => ({
          id: String(u._id),
          name: u.name,
          slug: u.slug,
        })),
      },
    });
  }),
);

router.get(
  '/universities/:universityId/campuses',
  resolveTenant,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const campuses = await Campus.find({
      university: req.params.universityId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, {
      data: {
        items: campuses.map((c) => ({
          id: String(c._id),
          name: c.name,
          slug: c.slug,
          city: c.city || '',
          university: String(c.university),
        })),
      },
    });
  }),
);

router.get(
  '/campuses/:campusId/departments',
  resolveTenant,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const departments = await Department.find({
      campus: req.params.campusId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, {
      data: {
        items: departments.map((d) => ({
          id: String(d._id),
          name: d.name,
          slug: d.slug,
          campus: String(d.campus),
          university: String(d.university),
        })),
      },
    });
  }),
);

router.get(
  '/departments/:departmentId/courses',
  resolveTenant,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const courses = await Course.find({
      department: req.params.departmentId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, {
      data: {
        items: courses.map((c) => ({
          id: String(c._id),
          name: c.name,
          slug: c.slug,
          department: String(c.department),
          campus: String(c.campus),
          university: String(c.university),
        })),
      },
    });
  }),
);

router.get(
  '/universities/:universityId/courses',
  resolveTenant,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const courses = await Course.find({
      university: req.params.universityId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, {
      data: {
        items: courses.map((c) => ({
          id: String(c._id),
          name: c.name,
          slug: c.slug,
          university: String(c.university),
          department: c.department ? String(c.department) : null,
        })),
      },
    });
  }),
);

router.get(
  '/courses/:courseId/subjects',
  resolveTenant,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const subjects = await Subject.find({
      course: req.params.courseId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, {
      data: {
        items: subjects.map((s) => ({
          id: String(s._id),
          name: s.name,
          slug: s.slug,
          course: String(s.course),
        })),
      },
    });
  }),
);

router.post(
  '/universities',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) throw new AppError('Name is required', 400);
    const university = await University.create({ name, slug: slugify(name) });
    return sendSuccess(res, {
      status: 201,
      message: 'University created',
      data: { id: String(university._id), name: university.name, slug: university.slug },
    });
  }),
);

export default router;
