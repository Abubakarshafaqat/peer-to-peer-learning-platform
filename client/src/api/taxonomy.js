import { api } from './client.js';

export async function getUniversities() {
  const { data } = await api.get('/taxonomy/universities');
  return data;
}

export async function getCampuses(universityId) {
  const { data } = await api.get(`/taxonomy/universities/${universityId}/campuses`);
  return data;
}

export async function getDepartments(campusId) {
  const { data } = await api.get(`/taxonomy/campuses/${campusId}/departments`);
  return data;
}

export async function getCourses(departmentId) {
  const { data } = await api.get(`/taxonomy/departments/${departmentId}/courses`);
  return data;
}

/** @deprecated Prefer getCourses(departmentId) */
export async function getCoursesByUniversity(universityId) {
  const { data } = await api.get(`/taxonomy/universities/${universityId}/courses`);
  return data;
}

export async function getSubjects(courseId) {
  const { data } = await api.get(`/taxonomy/courses/${courseId}/subjects`);
  return data;
}
