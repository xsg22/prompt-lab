import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { Project } from '@/types/Project';
import { useAuth } from '@/contexts/UnifiedAuthContext';

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  updateProject: (updatedProject: Project) => void;
  removeProject: (projectId: number) => void;
  addProject: (newProject: Project) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { user } = useAuth();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const prevUserIdRef = useRef(user?.id);

  useEffect(() => {
    if (prevUserIdRef.current !== user?.id) {
      prevUserIdRef.current = user?.id;
      setCurrentProject(null);
      setProjects([]);
    }
  }, [user?.id]);

  // 更新项目信息
  const updateProject = (updatedProject: Project) => {
    // 更新项目列表
    setProjects(prevProjects => 
      prevProjects.map(project => 
        project.id === updatedProject.id ? updatedProject : project
      )
    );

    // 如果是当前项目，也更新当前项目状态
    if (currentProject && currentProject.id === updatedProject.id) {
      setCurrentProject(updatedProject);
    }
  };

  // 移除项目
  const removeProject = (projectId: number) => {
    setProjects(prevProjects => 
      prevProjects.filter(project => project.id !== projectId)
    );

    // 如果删除的是当前项目，清空当前项目状态
    if (currentProject && currentProject.id === projectId) {
      setCurrentProject(null);
    }
  };

  // 添加新项目
  const addProject = (newProject: Project) => {
    setProjects(prevProjects => [...prevProjects, newProject]);
  };

  const value = {
    currentProject,
    projects,
    setCurrentProject,
    setProjects,
    updateProject,
    removeProject,
    addProject,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export default ProjectContext; 