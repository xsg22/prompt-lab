import {  useParams } from "react-router-dom"

export const useProjectJump = () => {
  const { projectId } = useParams();
  
  const projectJumpTo = (path: string) => {
    if (path.startsWith("/")) {
      path = path.slice(1);
    }
    return `/project/${projectId}/${path}`;
  };
  
  return { projectJumpTo };
};