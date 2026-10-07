package com.hms.doctor.mapper;

import com.hms.doctor.model.Department;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DepartmentMapper {

    Department findById(@Param("id") Long id);

    Department findByNameIgnoreCase(@Param("deptName") String deptName);

    Department findByNameIgnoreCaseExcludingId(@Param("deptName") String deptName, @Param("id") Long id);

    List<Department> findAll();

    List<Department> findAllActive();

    int insert(Department department);

    int update(Department department);

    int updateStatus(@Param("id") Long id, @Param("active") boolean active, @Param("updatedBy") Long updatedBy);

    long countActiveDoctorsByDepartment(@Param("departmentId") Long departmentId);

    long countAllDoctorsByDepartment(@Param("departmentId") Long departmentId);
}
