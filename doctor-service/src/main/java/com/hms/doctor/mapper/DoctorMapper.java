package com.hms.doctor.mapper;

import com.hms.doctor.model.Doctor;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DoctorMapper {

    Doctor findById(@Param("id") Long id);

    Doctor findByRegistrationNumber(@Param("registrationNumber") String registrationNumber);

    Doctor findByRegistrationNumberExcludingId(@Param("registrationNumber") String registrationNumber, @Param("id") Long id);

    List<Doctor> search(@Param("departmentId") Long departmentId,
                         @Param("name") String name,
                         @Param("active") Boolean active,
                         @Param("offset") int offset,
                         @Param("size") int size);

    long countSearch(@Param("departmentId") Long departmentId,
                      @Param("name") String name,
                      @Param("active") Boolean active);

    List<Doctor> findActiveByDepartment(@Param("departmentId") Long departmentId);

    int insert(Doctor doctor);

    int update(Doctor doctor);

    int updateStatus(@Param("id") Long id, @Param("active") boolean active, @Param("updatedBy") Long updatedBy);

    int updateLoginRegistered(@Param("id") Long id);
}
