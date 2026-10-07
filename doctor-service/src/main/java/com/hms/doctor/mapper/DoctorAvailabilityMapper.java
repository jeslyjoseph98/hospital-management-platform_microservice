package com.hms.doctor.mapper;

import com.hms.doctor.model.DoctorAvailability;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DoctorAvailabilityMapper {

    List<DoctorAvailability> findByDoctorId(@Param("doctorId") Long doctorId);

    int insert(DoctorAvailability availability);

    int deleteByDoctorId(@Param("doctorId") Long doctorId);
}
