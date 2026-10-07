package com.hms.userservice.mapper;

import com.hms.userservice.domain.Patient;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

@Mapper
public interface PatientMapper {

    int insert(Patient patient);

    int updatePatientCode(@Param("id") Long id, @Param("patientCode") String patientCode);

    Optional<Patient> findByUserId(@Param("userId") Long userId);

    Optional<Patient> findById(@Param("id") Long id);
}
