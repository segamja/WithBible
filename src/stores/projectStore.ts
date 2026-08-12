import { create } from 'zustand'
import * as projectService from '@/services/projectService'
import * as classService from '@/services/classService'
import type { BibleBook, ClassRow, Project, ProjectClass } from '@/types'

interface ProjectState {
  project: Project | null
  classes: ClassRow[]
  bibleBooks: BibleBook[]
  myProjectClass: (ProjectClass & { bible_books?: BibleBook }) | null
  loading: boolean
  error: string | null
  loadForUser: (classId: string | null) => Promise<void>
  refreshProjects: () => Promise<void>
  setProject: (project: Project | null) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  classes: [],
  bibleBooks: [],
  myProjectClass: null,
  loading: false,
  error: null,

  loadForUser: async (classId) => {
    set({ loading: true, error: null })
    try {
      const [project, classes, bibleBooks] = await Promise.all([
        projectService.getActiveProject(),
        classService.listClasses(),
        projectService.listBibleBooks(),
      ])
      let myProjectClass = null
      if (project && classId) {
        myProjectClass = await projectService.getProjectClass(project.id, classId)
      }
      set({ project, classes, bibleBooks, myProjectClass, loading: false })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '프로젝트 로드 실패',
      })
    }
  },

  refreshProjects: async () => {
    const project = await projectService.getActiveProject()
    set({ project })
  },

  setProject: (project) => set({ project }),
}))
