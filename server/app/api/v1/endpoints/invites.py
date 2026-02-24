from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any


from app.models.project import Project, ProjectInvitation, ProjectMember
from app.models.user import Users
from app.db.session import get_db
from app.api.deps import get_current_user

router = APIRouter(tags=["invites"])

# 验证邀请链接
@router.get("/{token}/validate", response_model=Dict[str, Any])
async def validate_invite(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    # 查询邀请记录
    result = await db.execute(select(ProjectInvitation).filter(
        ProjectInvitation.token == token,
        ProjectInvitation.is_expired == False
    ))
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="无效的邀请链接或邀请已被使用"
        )
    
    # 查询项目信息
    result = await db.execute(select(Project).filter(Project.id == invitation.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 查询邀请人信息
    result = await db.execute(select(Users).filter(Users.id == invitation.user_id))
    inviter = result.scalar_one_or_none()
    inviter_name = inviter.nickname if inviter and inviter.nickname else inviter.email if inviter else "未知用户"
    
    return {
        "projectId": project.id,
        "projectName": project.name,
        "inviterName": inviter_name
    }

# 接受邀请
@router.post("/{token}/accept")
async def accept_invite(
    token: str,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 查询邀请记录
    result = await db.execute(select(ProjectInvitation).filter(
        ProjectInvitation.token == token,
        ProjectInvitation.is_expired == False
    ))
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="无效的邀请链接或邀请已过期"
        )
    
    # 查询项目信息
    result = await db.execute(select(Project).filter(Project.id == invitation.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 检查用户是否已经是项目成员
    result = await db.execute(select(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == current_user.id
    ))
    existing_member = result.scalar_one_or_none()
    
    if existing_member:
        # 更新用户当前项目
        current_user.current_project_id = project.id
        await db.commit()
        
        return {"message": "您已经是项目成员"}
    
    # 添加用户为项目成员
    new_member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=invitation.role
    )
    
    db.add(new_member)
    
    # 更新用户当前项目
    current_user.current_project_id = project.id
    
    await db.commit()
    
    return {"message": "成功加入项目"} 