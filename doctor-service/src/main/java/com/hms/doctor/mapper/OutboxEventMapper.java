package com.hms.doctor.mapper;

import com.hms.doctor.model.OutboxEvent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface OutboxEventMapper {

    int insert(OutboxEvent event);

    List<OutboxEvent> findOldestNew(@Param("limit") int limit);

    int markSent(@Param("id") Long id, @Param("sentAt") LocalDateTime sentAt);
}
